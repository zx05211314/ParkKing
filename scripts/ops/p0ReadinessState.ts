import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { readConfig } from '../ingest/readConfig'
import { loadPublishGateExecutionState } from './publishGateExecutionState'
import { buildPublishGateRunSummary } from './publishGateRunSummary'
import { buildP0ReviewConfigDriftWarnings } from './p0ReadinessConfigDrift'
import { buildQaReviewSummary } from './qaReviewSummaryState'
import { runSmokeExactParkingAnswers } from './smokeExactParkingAnswers'
import type {
  P0ReadinessCheck,
  P0ReadinessParams,
  P0ReadinessResolvedInputs,
  P0ReadinessResult,
} from './p0ReadinessTypes'
import type { PublishGateRunSummary } from './publishGateRunSummary'

const DEFAULT_DISTRICT_ID = 'xinyi'
const DEFAULT_HHMM = '21:00'
const DEFAULT_SEARCH_RADIUS_METERS = 25
const DEFAULT_NEXT_REVIEW_ROWS_LIMIT = 10

const pathExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const resolveP0DefaultReviewPath = async (
  districtId: string,
  cwd = process.cwd(),
) => {
  const candidates = [
    path.join('.tmp', `${districtId}-current-review.merged.csv`),
    path.join('.tmp', `${districtId}-review.merged.csv`),
    path.join('.tmp', `${districtId}-review.csv`),
  ]

  for (const candidate of candidates) {
    if (await pathExists(path.resolve(cwd, candidate))) {
      return candidate
    }
  }
  return candidates[candidates.length - 1]
}

export const resolveP0ReadinessInputs = async ({
  districtId,
  datasetDir,
  reviewPath,
  manifestPath,
  configPath,
  publishReportPath,
  answerCasesPath,
  hhmm,
  searchRadiusMeters,
  nextReviewRowsLimit,
  allowPublishWarn,
  allowPublishFail,
  publishOverrideReason,
}: P0ReadinessParams, cwd = process.cwd()): Promise<P0ReadinessResolvedInputs> => {
  const resolvedDistrictId = districtId?.trim() || DEFAULT_DISTRICT_ID
  const resolvedReviewPath =
    reviewPath?.trim() || await resolveP0DefaultReviewPath(resolvedDistrictId, cwd)
  const resolvedAnswerCasesPath =
    answerCasesPath?.trim() ||
    (resolvedDistrictId === DEFAULT_DISTRICT_ID
      ? path.join('configs', 'prod', `${resolvedDistrictId}.answer-cases.json`)
      : null)
  return {
    districtId: resolvedDistrictId,
    datasetDir: path.resolve(
      cwd,
      datasetDir ?? path.join('public', 'data', 'generated', resolvedDistrictId),
    ),
    reviewPath: path.resolve(cwd, resolvedReviewPath),
    manifestPath: manifestPath ? path.resolve(cwd, manifestPath) : null,
    configPath: path.resolve(
      cwd,
      configPath ?? path.join('configs', 'prod', `${resolvedDistrictId}.json`),
    ),
    publishReportPath: path.resolve(
      cwd,
      publishReportPath ?? path.join('public', 'data', 'generated', 'ingest_all_report.json'),
    ),
    answerCasesPath: resolvedAnswerCasesPath
      ? path.resolve(cwd, resolvedAnswerCasesPath)
      : null,
    hhmm: hhmm?.trim() || DEFAULT_HHMM,
    searchRadiusMeters: searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS,
    nextReviewRowsLimit: nextReviewRowsLimit ?? DEFAULT_NEXT_REVIEW_ROWS_LIMIT,
    allowPublishWarn: Boolean(allowPublishWarn),
    allowPublishFail: Boolean(allowPublishFail),
    publishOverrideReason: publishOverrideReason?.trim() || null,
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const runCheck = async <T>(
  check: () => Promise<T>,
  isPass: (summary: T) => boolean,
): Promise<P0ReadinessCheck<T>> => {
  try {
    const summary = await check()
    return {
      pass: isPass(summary),
      summary,
      error: null,
    }
  } catch (error) {
    return {
      pass: false,
      summary: null,
      error: errorMessage(error),
    }
  }
}

const buildPublishGateSummary = async (
  reportPath: string,
  allowWarn: boolean,
  allowFail: boolean,
  overrideReason: string | null,
) => {
  const {
    runtime,
    bootstrapState,
    baselineAdoptState,
    districtSummaries,
    totals,
    exitCode,
  } = await loadPublishGateExecutionState({
    reportPath,
    allowWarn,
    allowFail,
    overrideReason,
  })

  return buildPublishGateRunSummary({
    reportPath: runtime.reportPath,
    mode: runtime.mode,
    allowWarn: runtime.allowWarn,
    allowFailRequested: runtime.allowFail,
    allowBaselineAdopt: runtime.allowBaselineAdopt,
    overrideReason: runtime.overrideReason,
    bootstrapState,
    baselineAdoptState,
    totals,
    districts: districtSummaries,
    exitCode,
  })
}

export const isP0DistrictPublishGatePass = (
  summary: PublishGateRunSummary,
  districtId: string,
) => {
  const district = summary.districts.find((entry) => entry.districtId === districtId)
  if (!district) {
    return false
  }
  if (district.fail > 0 && !summary.allowFail) {
    return false
  }
  if (district.warn > 0 && !summary.allowWarn) {
    return false
  }
  return true
}

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

const buildReviewPackProvenanceWarnings = async (
  summary: P0ReadinessResult['qaReview']['summary'],
  datasetDir: string,
) => {
  const manifest = summary?.manifest
  if (!manifest) {
    return []
  }
  const metaPath = path.resolve(datasetDir, 'dataset_meta.json')
  let meta: Record<string, unknown>
  try {
    meta = toRecord(JSON.parse(await fs.readFile(metaPath, 'utf-8')) as unknown)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return [`Review manifest could not be compared to dataset_meta.json: ${reason}`]
  }
  const warnings: string[] = []
  const districtId = getString(meta, 'districtId')
  const configHash = getString(meta, 'configHash')
  const datasetHash = getString(meta, 'datasetHash')
  if (manifest.districtId && districtId && manifest.districtId !== districtId) {
    warnings.push(
      `Review manifest district ${manifest.districtId} does not match runtime pack district ${districtId}.`,
    )
  }
  if (manifest.configHash && configHash && manifest.configHash !== configHash) {
    warnings.push(
      `Review manifest config hash ${manifest.configHash} does not match runtime pack config hash ${configHash}.`,
    )
  }
  if (manifest.datasetHash && datasetHash && manifest.datasetHash !== datasetHash) {
    warnings.push(
      `Review manifest dataset hash ${manifest.datasetHash} does not match runtime pack dataset hash ${datasetHash}.`,
    )
  }
  return warnings
}

const buildReviewConfigDriftWarnings = async (
  summary: P0ReadinessResult['qaReview']['summary'],
  configPath: string,
  datasetDir: string,
) => {
  const manifest = summary?.manifest
  if (!manifest) {
    return []
  }
  let config: Awaited<ReturnType<typeof readConfig>>
  try {
    config = await readConfig(['node', 'p0-readiness', '--config', configPath])
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return [`Review manifest could not be compared to current config: ${reason}`]
  }

  const metaPath = path.resolve(datasetDir, 'dataset_meta.json')
  let meta: Record<string, unknown> | null = null
  try {
    meta = toRecord(JSON.parse(await fs.readFile(metaPath, 'utf-8')) as unknown)
  } catch {
    meta = null
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

export const buildP0Readiness = async (
  params: P0ReadinessParams = {},
): Promise<P0ReadinessResult> => {
  const inputs = await resolveP0ReadinessInputs(params)
  const exactSmoke = await runCheck(
    () =>
      runSmokeExactParkingAnswers({
        datasetDir: inputs.datasetDir,
        hhmm: inputs.hhmm,
        searchRadiusMeters: inputs.searchRadiusMeters,
        minParkAnswers: 1,
        minNoStopAnswers: 1,
        minMarkedSpaceParkAnswers: 1,
        casesPath: inputs.answerCasesPath ?? undefined,
      }),
    () => true,
  )
  const qaReview = await runCheck(
    () =>
      buildQaReviewSummary({
        inputPath: inputs.reviewPath,
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
      }),
    (summary) => summary.pass,
  )
  const publishGate = await runCheck(
    () =>
      buildPublishGateSummary(
        inputs.publishReportPath,
        inputs.allowPublishWarn,
        inputs.allowPublishFail,
        inputs.publishOverrideReason,
      ),
    (summary) => isP0DistrictPublishGatePass(summary, inputs.districtId),
  )
  const reviewPackProvenanceWarnings = await buildReviewPackProvenanceWarnings(
    qaReview.summary,
    inputs.datasetDir,
  )
  const reviewConfigDriftWarnings = await buildReviewConfigDriftWarnings(
    qaReview.summary,
    inputs.configPath,
    inputs.datasetDir,
  )
  const reviewProvenanceWarnings = [
    ...reviewPackProvenanceWarnings,
    ...reviewConfigDriftWarnings,
  ]

  return {
    pass: exactSmoke.pass && qaReview.pass && publishGate.pass,
    inputs,
    exactSmoke,
    qaReview,
    publishGate,
    reviewPackProvenanceWarnings,
    reviewConfigDriftWarnings,
    reviewProvenanceWarnings,
  }
}
