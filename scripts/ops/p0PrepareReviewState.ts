import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { readConfig } from '../ingest/readConfig'
import { buildQaReviewChecklist } from './qaReviewChecklistState'
import { formatQaReviewChecklist } from './qaReviewChecklistOutput'
import { buildQaReviewGeojson } from './qaReviewGeojsonState'
import { formatQaNextReviewRowsCsv } from './qaReviewSummaryOutput'
import { buildQaReviewSummary } from './qaReviewSummaryState'
import { buildP0ReviewConfigDriftWarnings } from './p0ReadinessConfigDrift'
import type { QaReviewSummary } from './qaReviewSummaryTypes'
import type {
  P0PrepareReviewInputs,
  P0PrepareReviewParams,
  P0PrepareReviewResult,
} from './p0PrepareReviewTypes'

const DEFAULT_DISTRICT_ID = 'xinyi'
const DEFAULT_NEXT_REVIEW_ROWS_LIMIT = 10

const resolveInputs = ({
  districtId,
  sourcePath,
  manifestPath,
  configPath,
  nextReviewOutPath,
  checklistOutPath,
  geojsonOutPath,
  mergedOutPath,
  nextReviewRowsLimit,
}: P0PrepareReviewParams): P0PrepareReviewInputs => {
  const resolvedDistrictId = districtId?.trim() || DEFAULT_DISTRICT_ID
  return {
    districtId: resolvedDistrictId,
    sourcePath: path.resolve(
      sourcePath ?? path.join('.tmp', `${resolvedDistrictId}-review.csv`),
    ),
    manifestPath: manifestPath ? path.resolve(manifestPath) : null,
    configPath: path.resolve(
      configPath ?? path.join('configs', 'prod', `${resolvedDistrictId}.json`),
    ),
    nextReviewOutPath: path.resolve(
      nextReviewOutPath ?? path.join('.tmp', `${resolvedDistrictId}-next-review.csv`),
    ),
    checklistOutPath: path.resolve(
      checklistOutPath ?? path.join('.tmp', `${resolvedDistrictId}-next-review.md`),
    ),
    geojsonOutPath: path.resolve(
      geojsonOutPath ?? path.join('.tmp', `${resolvedDistrictId}-next-review.geojson`),
    ),
    mergedOutPath: path.resolve(
      mergedOutPath ?? path.join('.tmp', `${resolvedDistrictId}-review.merged.csv`),
    ),
    nextReviewRowsLimit: nextReviewRowsLimit ?? DEFAULT_NEXT_REVIEW_ROWS_LIMIT,
  }
}

const isExpectedP0ReviewBlocker = (error: string) =>
  error.startsWith('Valid reviewed rows ') ||
  error.startsWith('Missing required review status ') ||
  error.startsWith('Missing reviewed row for required bucket ') ||
  error.startsWith('Reviewed rows for bucket ')

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getString = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'string' && record[key].trim().length > 0
    ? record[key].trim()
    : null

const getNumber = (record: Record<string, unknown>, key: string) =>
  typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : null

const getSourceFiles = (record: Record<string, unknown>) => {
  const sourceFiles = record.sourceFiles
  if (!Array.isArray(sourceFiles)) {
    return []
  }
  return sourceFiles
    .map((entry) => toRecord(entry))
    .map((entry) => ({
      path: getString(entry, 'path') ?? '',
      mtimeMs: getNumber(entry, 'mtimeMs') ?? 0,
      size: getNumber(entry, 'size') ?? 0,
    }))
    .filter((entry) => entry.path)
}

const buildManifestConfigErrors = async (
  summary: QaReviewSummary,
  configPath: string,
) => {
  const manifest = summary.manifest
  if (!manifest) {
    return []
  }
  const config = await readConfig(['node', 'p0-prepare-review', '--config', configPath])
  let meta: Record<string, unknown> | null = null
  if (manifest.datasetBaseDir) {
    try {
      meta = toRecord(
        JSON.parse(
          await fs.readFile(path.resolve(manifest.datasetBaseDir, 'dataset_meta.json'), 'utf-8'),
        ) as unknown,
      )
    } catch {
      meta = null
    }
  }
  return buildP0ReviewConfigDriftWarnings({
    manifest,
    current: config,
    runtime: meta
      ? {
          districtId: getString(meta, 'districtId'),
          configHash: getString(meta, 'configHash'),
          datasetHash: getString(meta, 'datasetHash'),
          sourceFiles: getSourceFiles(meta),
          signOverrideMatchToleranceMeters: getNumber(
            meta,
            'signOverrideMatchToleranceMeters',
          ),
        }
      : null,
  })
}

const writeText = async (outPath: string, body: string) => {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, body, 'utf-8')
}

export const buildP0PrepareReview = async (
  params: P0PrepareReviewParams = {},
): Promise<P0PrepareReviewResult> => {
  const inputs = resolveInputs(params)
  const errors: string[] = []
  const warnings: string[] = []

  const qaReview = await buildQaReviewSummary({
    inputPath: inputs.sourcePath,
    manifestPath: inputs.manifestPath,
    strictManifest: true,
    strictReviewedRows: true,
    strictReviewedSegments: true,
    nextReviewRowsLimit: inputs.nextReviewRowsLimit,
    minReviewed: 1,
    requireStatuses: ['LEGAL', 'ILLEGAL'],
    requireBuckets: ['marked_space_park'],
    minReviewedBuckets: {
      marked_space_park: 2,
      no_stop: 2,
    },
  })
  warnings.push(...qaReview.warnings)

  const fatalReviewErrors = qaReview.errors.filter(
    (error) => !isExpectedP0ReviewBlocker(error),
  )
  const manifestConfigErrors = await buildManifestConfigErrors(qaReview, inputs.configPath)
  fatalReviewErrors.push(
    ...manifestConfigErrors.filter((error) =>
      error.startsWith('Review manifest district '),
    ),
  )
  warnings.push(
    ...manifestConfigErrors
      .filter((error) => !error.startsWith('Review manifest district '))
      .map((warning) => `Config provenance: ${warning}`),
  )

  if (fatalReviewErrors.length > 0) {
    errors.push(...fatalReviewErrors)
    return {
      pass: false,
      inputs,
      qaReview,
      fatalReviewErrors,
      nextReviewRowsWritten: 0,
      checklist: null,
      geojson: null,
      errors,
      warnings,
    }
  }

  if (!qaReview.pass && qaReview.nextReviewRows.length === 0) {
    errors.push('QA review inputs are blocked but produced no next-review rows.')
    return {
      pass: false,
      inputs,
      qaReview,
      fatalReviewErrors,
      nextReviewRowsWritten: 0,
      checklist: null,
      geojson: null,
      errors,
      warnings,
    }
  }

  await writeText(inputs.nextReviewOutPath, formatQaNextReviewRowsCsv(qaReview))

  if (qaReview.pass && qaReview.nextReviewRows.length === 0) {
    warnings.push('QA review gate inputs already pass; no additional handoff review is required.')
    return {
      pass: true,
      inputs,
      qaReview,
      fatalReviewErrors,
      nextReviewRowsWritten: 0,
      checklist: null,
      geojson: null,
      errors,
      warnings,
    }
  }

  const checklist = await buildQaReviewChecklist({
    inputPath: inputs.nextReviewOutPath,
    sourcePath: inputs.sourcePath,
    outPath: inputs.checklistOutPath,
    mergedOutPath: inputs.mergedOutPath,
    configPath: inputs.configPath,
    title: `${inputs.districtId} gate-critical rows`,
  })
  await writeText(inputs.checklistOutPath, `${formatQaReviewChecklist(checklist)}\n`)
  if (!checklist.pass) {
    errors.push(...checklist.errors.map((error) => `Checklist: ${error}`))
  }
  warnings.push(...checklist.warnings.map((warning) => `Checklist: ${warning}`))

  const geojson = await buildQaReviewGeojson({
    inputPath: inputs.nextReviewOutPath,
    outPath: inputs.geojsonOutPath,
  })
  if (!geojson.pass) {
    errors.push(...geojson.errors.map((error) => `GeoJSON: ${error}`))
  }
  warnings.push(...geojson.warnings.map((warning) => `GeoJSON: ${warning}`))

  return {
    pass: errors.length === 0,
    inputs,
    qaReview,
    fatalReviewErrors,
    nextReviewRowsWritten: qaReview.nextReviewRows.length,
    checklist,
    geojson,
    errors,
    warnings,
  }
}
