import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { parse as parseCsv } from 'csv-parse/sync'
import { applyQaReviewHandoff } from './qaReviewApplyState'
import { buildQaReviewGate } from './qaReviewGateState'
import type {
  P0PromoteReviewInputs,
  P0PromoteReviewParams,
  P0PromoteReviewResult,
} from './p0PromoteReviewTypes'

const DEFAULT_DISTRICT_ID = 'xinyi'

interface CsvTable {
  headers: string[]
  rows: string[][]
}

const parseCsvTable = (raw: string): CsvTable => {
  const records = parseCsv(raw, {
    bom: true,
    skip_empty_lines: true,
  }) as string[][]
  const headers = records[0] ?? []
  const rows = records.slice(1).map((row) => {
    const normalized = [...row]
    while (normalized.length < headers.length) {
      normalized.push('')
    }
    return normalized
  })
  return { headers, rows }
}

const normalizeHeader = (value: string) => value.trim().toLowerCase()

const findHeaderIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex(
      (header) => header === normalizeHeader(candidate),
    )
    if (index >= 0) {
      return index
    }
  }
  return -1
}

const getCell = (row: string[], index: number) =>
  index >= 0 ? (row[index] ?? '').trim() : ''

const adjacentManifestPath = (inputPath: string) => {
  const ext = path.extname(inputPath)
  const basePath = ext ? inputPath.slice(0, -ext.length) : inputPath
  return `${basePath}.manifest.json`
}

const validateReviewedHandoffEvidence = async (reviewsPath: string) => {
  const errors: string[] = []
  const table = parseCsvTable(await fs.readFile(reviewsPath, 'utf-8'))
  const statusIndex = findHeaderIndex(table.headers, [
    'reviewStatus',
    'status',
    'overrideStatus',
    'signOverrideStatus',
  ])
  const noteIndex = findHeaderIndex(table.headers, [
    'reviewNote',
    'note',
    'overrideNote',
  ])
  const createdAtIndex = findHeaderIndex(table.headers, [
    'createdAt',
    'reviewedAt',
    'verifiedAt',
  ])

  if (statusIndex < 0) {
    return { errors, reviewedRows: 0, totalRows: table.rows.length }
  }

  let reviewedRows = 0
  table.rows.forEach((row, index) => {
    const status = getCell(row, statusIndex)
    if (!status) {
      return
    }
    reviewedRows += 1
    const csvRowNumber = index + 2
    if (noteIndex < 0 || !getCell(row, noteIndex)) {
      errors.push(
        `Review handoff row ${csvRowNumber}: reviewed rows must include reviewNote evidence before P0 promotion.`,
      )
    }
    if (createdAtIndex < 0 || !getCell(row, createdAtIndex)) {
      errors.push(
        `Review handoff row ${csvRowNumber}: reviewed rows must include createdAt/reviewedAt timestamp before P0 promotion.`,
      )
    }
  })

  return { errors, reviewedRows, totalRows: table.rows.length }
}

const resolveInputs = ({
  districtId,
  sourcePath,
  reviewsPath,
  mergedOutPath,
  configPath,
  outDir,
}: P0PromoteReviewParams): P0PromoteReviewInputs => {
  const resolvedDistrictId = districtId?.trim() || DEFAULT_DISTRICT_ID
  return {
    districtId: resolvedDistrictId,
    sourcePath: path.resolve(
      sourcePath ?? path.join('.tmp', `${resolvedDistrictId}-review.csv`),
    ),
    reviewsPath: path.resolve(
      reviewsPath ?? path.join('.tmp', `${resolvedDistrictId}-next-review.csv`),
    ),
    mergedOutPath: path.resolve(
      mergedOutPath ?? path.join('.tmp', `${resolvedDistrictId}-review.merged.csv`),
    ),
    configPath: path.resolve(
      configPath ?? path.join('configs', 'prod', `${resolvedDistrictId}.json`),
    ),
    outDir: outDir ? path.resolve(outDir) : null,
  }
}

const copySourceReviewToMerged = async (
  sourcePath: string,
  mergedOutPath: string,
) => {
  await fs.mkdir(path.dirname(mergedOutPath), { recursive: true })
  await fs.copyFile(sourcePath, mergedOutPath)

  const sourceManifestPath = adjacentManifestPath(sourcePath)
  const mergedManifestPath = adjacentManifestPath(mergedOutPath)
  try {
    const manifest = JSON.parse(await fs.readFile(sourceManifestPath, 'utf-8')) as Record<
      string,
      unknown
    >
    manifest.csvPath = mergedOutPath
    await fs.writeFile(mergedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
    return mergedManifestPath
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const buildPromotionGate = async (inputs: P0PromoteReviewInputs, inputPath: string) =>
  buildQaReviewGate({
    inputPath,
    configPath: inputs.configPath,
    outDir: inputs.outDir,
    strictManifest: true,
    strictConfigProvenance: false,
    strictReviewedRows: true,
    strictReviewedSegments: true,
    minReviewed: 1,
    requireStatuses: ['LEGAL', 'ILLEGAL'],
    requireBuckets: ['marked_space_park'],
    minReviewedBuckets: {
      marked_space_park: 2,
      no_stop: 2,
    },
  })

export const buildP0PromoteReview = async (
  params: P0PromoteReviewParams = {},
): Promise<P0PromoteReviewResult> => {
  const inputs = resolveInputs(params)
  const evidence = await validateReviewedHandoffEvidence(inputs.reviewsPath)
  if (evidence.errors.length > 0) {
    return {
      pass: false,
      inputs,
      apply: null,
      gate: null,
      errors: evidence.errors,
      warnings: [],
    }
  }

  if (evidence.reviewedRows === 0) {
    const gate = await buildPromotionGate(inputs, inputs.sourcePath)
    const errors = [...gate.errors]
    const warnings = [...gate.warnings]
    if (gate.pass) {
      const manifestPath = await copySourceReviewToMerged(inputs.sourcePath, inputs.mergedOutPath)
      warnings.push(
        `Source review CSV already satisfies P0 gate; copied source to merged output without handoff apply.${manifestPath ? ` Manifest: ${manifestPath}` : ''}`,
      )
    }
    return {
      pass: gate.pass,
      inputs,
      apply: null,
      gate,
      errors,
      warnings,
    }
  }

  const apply = await applyQaReviewHandoff({
    sourcePath: inputs.sourcePath,
    reviewsPath: inputs.reviewsPath,
    outPath: inputs.mergedOutPath,
  })
  const warnings = [...apply.warnings]
  const errors = [...apply.errors]

  if (!apply.pass) {
    return {
      pass: false,
      inputs,
      apply,
      gate: null,
      errors,
      warnings,
    }
  }

  const gate = await buildPromotionGate(inputs, inputs.mergedOutPath)
  errors.push(...gate.errors)
  warnings.push(...gate.warnings)

  return {
    pass: gate.pass,
    inputs,
    apply,
    gate,
    errors,
    warnings,
  }
}
