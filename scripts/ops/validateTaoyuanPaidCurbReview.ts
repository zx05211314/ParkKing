import * as fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import {
  parsePaidCurbReferencePack,
  type PaidCurbReferencePack,
} from '../../src/data/paidCurbReference'

const DEFAULT_DISTRICT = 'taoyuan-district'
const DEFAULT_REVIEW_DIR = 'review-evidence/taoyuan'
const DEFAULT_REFERENCE = 'public/data/reference/taoyuan-paid-curb.json'

const ALLOWED_STATUSES = new Set([
  'APPROVED_SOURCE_TEXT',
  'NEEDS_CORRECTION',
  'UNCLEAR',
])

export interface ReviewManifest {
  schemaVersion: 1
  districtId: string
  sourceSha256: string
  sourceRecordCount: number
  reviewRecordCount: number
  geometryAvailable: false
  legalAnswerEligible: false
  allowedStatuses: string[]
  reviewCsv?: string
  reviewSha256?: string
  approvedRecordCount?: number
  templateCsv?: string
}

export type CsvRow = Record<string, string>

const normalize = (value: unknown) => String(value ?? '').trim()
const normalizeStatus = (value: unknown) => normalize(value).toUpperCase()

const parseBooleanCell = (value: unknown) => {
  const normalized = normalize(value).toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return null
}

const validateManifest = (
  manifest: ReviewManifest,
  pack: PaidCurbReferencePack,
  districtId: string,
  reviewSha256?: string,
  requirePinnedReview?: boolean,
) => {
  const errors: string[] = []
  const district = pack.districts.find(
    (candidate) => candidate.districtId === districtId,
  )
  if (!district) {
    return { errors: [`Reference pack is missing district ${districtId}.`], district: null }
  }
  const comparisons: Array<[string, unknown, unknown]> = [
    ['schemaVersion', manifest.schemaVersion, 1],
    ['districtId', manifest.districtId, districtId],
    ['sourceSha256', manifest.sourceSha256, pack.source.sha256],
    ['sourceRecordCount', manifest.sourceRecordCount, pack.source.recordCount],
    ['reviewRecordCount', manifest.reviewRecordCount, district.recordCount],
    ['geometryAvailable', manifest.geometryAvailable, false],
    ['legalAnswerEligible', manifest.legalAnswerEligible, false],
  ]
  comparisons.forEach(([field, actual, expected]) => {
    if (actual !== expected) {
      errors.push(
        `Review manifest ${field} is ${String(actual)}, expected ${String(expected)}.`,
      )
    }
  })
  const statuses = new Set(manifest.allowedStatuses ?? [])
  if (
    statuses.size !== ALLOWED_STATUSES.size ||
    [...ALLOWED_STATUSES].some((status) => !statuses.has(status))
  ) {
    errors.push('Review manifest allowedStatuses do not match the source-text contract.')
  }
  if (requirePinnedReview && manifest.reviewSha256 === undefined) {
    errors.push('Review manifest must pin reviewSha256 for promoted evidence.')
  } else if (
    manifest.reviewSha256 !== undefined &&
    manifest.reviewSha256 !== reviewSha256
  ) {
    errors.push('Review manifest reviewSha256 does not match the review CSV.')
  }
  if (requirePinnedReview && manifest.approvedRecordCount === undefined) {
    errors.push(
      'Review manifest must pin approvedRecordCount for promoted evidence.',
    )
  } else if (
    manifest.approvedRecordCount !== undefined &&
    manifest.approvedRecordCount !== district.recordCount
  ) {
    errors.push(
      `Review manifest approvedRecordCount is ${String(manifest.approvedRecordCount)}, expected ${district.recordCount}.`,
    )
  }
  return { errors, district }
}

export const validateTaoyuanPaidCurbReview = (params: {
  pack: PaidCurbReferencePack
  manifest: ReviewManifest
  rows: CsvRow[]
  districtId: string
  reviewSha256?: string
  requirePinnedReview?: boolean
  requireComplete?: boolean
  requireApproved?: boolean
}) => {
  const manifestResult = validateManifest(
    params.manifest,
    params.pack,
    params.districtId,
    params.reviewSha256,
    params.requirePinnedReview,
  )
  const errors = [...manifestResult.errors]
  const district = manifestResult.district
  const statusCounts: Record<string, number> = {
    APPROVED_SOURCE_TEXT: 0,
    NEEDS_CORRECTION: 0,
    UNCLEAR: 0,
    PENDING: 0,
    INVALID: 0,
  }
  if (!district) {
    return {
      pass: false,
      structureValid: false,
      complete: false,
      approved: false,
      errors,
      statusCounts,
      expectedRows: 0,
      actualRows: params.rows.length,
    }
  }

  const recordsById = new Map(
    district.records.map((record) => [record.parkingSegmentId, record]),
  )
  const seenIds = new Set<string>()
  for (const [index, row] of params.rows.entries()) {
    const rowNumber = index + 2
    const segmentId = normalize(row.parking_segment_id)
    if (!segmentId) {
      errors.push(`Row ${rowNumber}: parking_segment_id is required.`)
      continue
    }
    if (seenIds.has(segmentId)) {
      errors.push(`Row ${rowNumber}: duplicate parking_segment_id ${segmentId}.`)
      continue
    }
    seenIds.add(segmentId)
    const record = recordsById.get(segmentId)
    if (!record) {
      errors.push(`Row ${rowNumber}: unknown parking_segment_id ${segmentId}.`)
      continue
    }
    const immutableComparisons: Array<[string, unknown, unknown]> = [
      ['district_id', normalize(row.district_id), district.districtId],
      ['district_name', normalize(row.district_name), district.districtName],
      ['description', normalize(row.description), record.description],
      [
        'fare_description',
        normalize(row.fare_description),
        record.fareDescription ?? '',
      ],
      [
        'has_charging_point',
        parseBooleanCell(row.has_charging_point),
        record.hasChargingPoint,
      ],
      ['geometry_available', parseBooleanCell(row.geometry_available), false],
      [
        'legal_answer_eligible',
        parseBooleanCell(row.legal_answer_eligible),
        false,
      ],
    ]
    immutableComparisons.forEach(([field, actual, expected]) => {
      if (actual !== expected) {
        errors.push(`Row ${rowNumber}: ${field} does not match the reference pack.`)
      }
    })

    const status = normalizeStatus(row.source_text_review_status)
    const note = normalize(row.source_text_review_note)
    if (!status) {
      statusCounts.PENDING += 1
    } else if (!ALLOWED_STATUSES.has(status)) {
      statusCounts.INVALID += 1
      errors.push(`Row ${rowNumber}: invalid source_text_review_status ${status}.`)
    } else {
      statusCounts[status] += 1
      if (status !== 'APPROVED_SOURCE_TEXT' && !note) {
        errors.push(`Row ${rowNumber}: ${status} requires source_text_review_note.`)
      }
    }
  }

  recordsById.forEach((_record, segmentId) => {
    if (!seenIds.has(segmentId)) {
      errors.push(`Review CSV is missing parking_segment_id ${segmentId}.`)
    }
  })
  if (params.rows.length !== district.recordCount) {
    errors.push(
      `Review CSV has ${params.rows.length} rows, expected ${district.recordCount}.`,
    )
  }

  const structureValid = errors.length === 0
  const complete = structureValid && statusCounts.PENDING === 0
  const approved =
    complete && statusCounts.APPROVED_SOURCE_TEXT === district.recordCount
  const requireComplete = params.requireComplete || params.requireApproved
  const pass =
    structureValid &&
    (!requireComplete || complete) &&
    (!params.requireApproved || approved)
  if (requireComplete && !complete && structureValid) {
    errors.push(`${statusCounts.PENDING} source-text review rows are still pending.`)
  }
  if (params.requireApproved && !approved && complete) {
    errors.push(
      'Source-text review is complete but contains rows that are not APPROVED_SOURCE_TEXT.',
    )
  }

  return {
    pass,
    structureValid,
    complete,
    approved,
    errors,
    statusCounts,
    expectedRows: district.recordCount,
    actualRows: params.rows.length,
  }
}

const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

export const sha256TaoyuanReviewCsv = (buffer: Buffer) =>
  createHash('sha256')
    .update(buffer.toString('utf-8').replace(/\r\n?/g, '\n'), 'utf-8')
    .digest('hex')

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const renderReport = (
  districtId: string,
  result: ReturnType<typeof validateTaoyuanPaidCurbReview>,
) => [
  '# Taoyuan paid-curb source-text review',
  '',
  `- District: ${districtId}`,
  `- Gate: ${result.pass ? 'PASS' : 'BLOCKED'}`,
  `- Structure/provenance: ${result.structureValid ? 'valid' : 'invalid'}`,
  `- Complete: ${result.complete ? 'yes' : 'no'}`,
  `- All source text approved: ${result.approved ? 'yes' : 'no'}`,
  `- Rows: ${result.actualRows}/${result.expectedRows}`,
  `- Statuses: ${Object.entries(result.statusCounts)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ')}`,
  '- Safety: approval confirms source transcription only; geometry and legal-answer eligibility remain false.',
  ...(result.errors.length > 0
    ? ['', '## Errors', '', ...result.errors.map((error) => `- ${error}`)]
    : []),
  '',
].join('\n')

const run = async () => {
  const explicitReviewPaths =
    process.argv.includes('--review-dir') ||
    process.argv.includes('--input') ||
    process.argv.includes('--manifest')
  const districtId = getArgValue(process.argv, '--district') ?? DEFAULT_DISTRICT
  const reviewDir = path.resolve(
    getArgValue(process.argv, '--review-dir') ?? DEFAULT_REVIEW_DIR,
  )
  const baseName = `${districtId}-paid-curb-review`
  const reviewPath = path.resolve(
    getArgValue(process.argv, '--input') ??
      path.join(reviewDir, `${baseName}.csv`),
  )
  const manifestPath = path.resolve(
    getArgValue(process.argv, '--manifest') ??
      path.join(reviewDir, `${baseName}.manifest.json`),
  )
  const referencePath = path.resolve(
    getArgValue(process.argv, '--reference') ?? DEFAULT_REFERENCE,
  )
  const reviewBuffer = await fs.readFile(reviewPath)
  const rows = parseCsv(reviewBuffer, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[]
  const result = validateTaoyuanPaidCurbReview({
    pack: parsePaidCurbReferencePack(await readJson(referencePath)),
    manifest: await readJson<ReviewManifest>(manifestPath),
    rows,
    districtId,
    reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
    requirePinnedReview: !explicitReviewPaths,
    requireComplete:
      process.argv.includes('--require-complete') ||
      process.argv.includes('--require-approved'),
    requireApproved: process.argv.includes('--require-approved'),
  })
  const report = renderReport(districtId, result)
  console.log(report)
  const outputPath = getArgValue(process.argv, '--out')
  if (outputPath) {
    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true })
    await fs.writeFile(path.resolve(outputPath), report, 'utf-8')
  }
  const jsonOutputPath = getArgValue(process.argv, '--json-out')
  if (jsonOutputPath) {
    await fs.mkdir(path.dirname(path.resolve(jsonOutputPath)), { recursive: true })
    await fs.writeFile(
      path.resolve(jsonOutputPath),
      `${JSON.stringify({ districtId, ...result }, null, 2)}\n`,
      'utf-8',
    )
  }
  if (!result.pass) {
    process.exitCode = 1
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
