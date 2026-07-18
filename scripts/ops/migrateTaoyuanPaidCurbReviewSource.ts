import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseCsv } from 'csv-parse/sync'
import {
  parsePaidCurbReferencePack,
  type PaidCurbReferencePack,
  type PaidCurbReferenceRecord,
} from '../../src/data/paidCurbReference'
import {
  type CsvRow,
  type ReviewManifest,
  sha256TaoyuanReviewCsv,
  validateTaoyuanPaidCurbReview,
} from './validateTaoyuanPaidCurbReview'

const DEFAULT_PREVIOUS_REFERENCE =
  '.tmp/taoyuan-source-refresh/taoyuan-paid-curb.previous.json'
const DEFAULT_CURRENT_REFERENCE =
  'public/data/reference/taoyuan-paid-curb.json'
const DEFAULT_EVIDENCE_DIR = 'review-evidence/taoyuan'
const DEFAULT_OUTPUT_DIR = '.tmp/taoyuan-source-refresh-review'
const DEFAULT_APPROVAL = '.tmp/guishan-spatial-text-conflict-review.csv'
const DEFAULT_RECEIPT = '.tmp/taoyuan-source-refresh-review-receipt.json'
const ACCEPT_DECISION = 'ACCEPT_CURRENT_TDX'
const ALLOWED_STATUSES = [
  'APPROVED_SOURCE_TEXT',
  'NEEDS_CORRECTION',
  'UNCLEAR',
]
const REVIEW_COLUMNS = [
  'parking_segment_id',
  'district_id',
  'district_name',
  'description',
  'fare_description',
  'has_charging_point',
  'geometry_available',
  'legal_answer_eligible',
  'source_text_review_status',
  'source_text_review_note',
] as const
const REVIEWABLE_FIELDS = [
  'description',
  'fare_description',
  'has_charging_point',
  'source_town_name',
] as const

type ReviewableField = (typeof REVIEWABLE_FIELDS)[number]

interface ApprovalRow extends CsvRow {
  parking_segment_id: string
  field: string
  approved_source_text: string
  current_tdx_text: string
  decision: string
  review_note: string
}

interface SourceRecord {
  districtId: string
  districtName: string
  record: PaidCurbReferenceRecord
}

interface SourceDifference {
  parkingSegmentId: string
  districtId: string
  field: ReviewableField
  previousValue: string
  currentValue: string
  reviewNote: string
}

export interface MigrateTaoyuanPaidCurbReviewSourceOptions {
  previousReferencePath?: string
  currentReferencePath?: string
  evidenceDir?: string
  approvalPath?: string
  outputDir?: string
  receiptPath?: string
  now?: Date
}

export interface TaoyuanPaidCurbSourceMigrationReceipt {
  schemaVersion: 1
  migratedAt: string
  previousReferencePath: string
  currentReferencePath: string
  evidenceDir: string
  outputDir: string
  approval: {
    path: string
    sha256: string
    decision: typeof ACCEPT_DECISION
  }
  source: {
    previousSha256: string
    currentSha256: string
    recordCount: number
  }
  differences: SourceDifference[]
  migratedDistricts: Array<{
    districtId: string
    approvedRows: number
    reviewSha256: string
  }>
  totalApprovedRows: number
  safety: {
    geometryAvailable: false
    legalAnswerEligible: false
  }
}

const sha256 = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const portablePath = (targetPath: string) => {
  const relative = path.relative(process.cwd(), targetPath)
  return (relative || '.').replace(/\\/g, '/')
}

const normalize = (value: unknown) => String(value ?? '').trim()

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const serializeReviewCsv = (rows: CsvRow[]) =>
  `${[
    REVIEW_COLUMNS.join(','),
    ...rows.map((row) =>
      REVIEW_COLUMNS.map((column) => escapeCsvCell(row[column])).join(','),
    ),
  ].join('\n')}\n`

const parseJson = <T>(buffer: Buffer, label: string): T => {
  try {
    return JSON.parse(buffer.toString('utf-8')) as T
  } catch {
    throw new Error(`${label} is not valid JSON.`)
  }
}

const getRecordValue = (
  record: PaidCurbReferenceRecord,
  field: ReviewableField,
) => {
  if (field === 'description') return record.description
  if (field === 'fare_description') return record.fareDescription ?? ''
  if (field === 'has_charging_point') return String(record.hasChargingPoint)
  return record.sourceTownName
}

const buildRecordIndex = (pack: PaidCurbReferencePack) =>
  new Map<string, SourceRecord>(
    pack.districts.flatMap((district) =>
      district.records.map((record) => [
        record.parkingSegmentId,
        {
          districtId: district.districtId,
          districtName: district.districtName,
          record,
        },
      ]),
    ),
  )

const readReference = async (targetPath: string) => {
  const buffer = await fs.readFile(targetPath)
  return {
    buffer,
    pack: parsePaidCurbReferencePack(
      parseJson<unknown>(buffer, portablePath(targetPath)),
    ),
  }
}

const readApprovedEvidence = async (params: {
  pack: PaidCurbReferencePack
  districtId: string
  evidenceDir: string
}) => {
  const baseName = `${params.districtId}-paid-curb-review`
  const reviewPath = path.join(params.evidenceDir, `${baseName}.csv`)
  const manifestPath = path.join(
    params.evidenceDir,
    `${baseName}.manifest.json`,
  )
  const [reviewBuffer, manifestBuffer] = await Promise.all([
    fs.readFile(reviewPath),
    fs.readFile(manifestPath),
  ])
  let rows: CsvRow[]
  try {
    rows = parseCsv(reviewBuffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[]
  } catch (error) {
    throw new Error(
      `${params.districtId}: previous review evidence failed the pinned approval gate:\n${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const validation = validateTaoyuanPaidCurbReview({
    pack: params.pack,
    manifest: parseJson<ReviewManifest>(
      manifestBuffer,
      portablePath(manifestPath),
    ),
    rows,
    districtId: params.districtId,
    reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
    requirePinnedReview: true,
    requireApproved: true,
  })
  if (!validation.pass || !validation.approved) {
    throw new Error(
      `${params.districtId}: previous review evidence failed the pinned approval gate:\n${validation.errors.join('\n')}`,
    )
  }
  return rows
}

const validatePackShape = (
  previousPack: PaidCurbReferencePack,
  currentPack: PaidCurbReferencePack,
) => {
  if (previousPack.source.sha256 === currentPack.source.sha256) {
    throw new Error('Previous and current source SHA-256 values are identical.')
  }
  if (previousPack.source.recordCount !== currentPack.source.recordCount) {
    throw new Error('Source record additions or removals require a new human review.')
  }
  const previousDistricts = new Map(
    previousPack.districts.map((district) => [district.districtId, district]),
  )
  for (const currentDistrict of currentPack.districts) {
    const previousDistrict = previousDistricts.get(currentDistrict.districtId)
    if (
      !previousDistrict ||
      previousDistrict.districtName !== currentDistrict.districtName ||
      previousDistrict.boundaryFeatureId !== currentDistrict.boundaryFeatureId ||
      previousDistrict.recordCount !== currentDistrict.recordCount
    ) {
      throw new Error(
        `District shape changed for ${currentDistrict.districtId}; a new human review is required.`,
      )
    }
    previousDistricts.delete(currentDistrict.districtId)
  }
  if (previousDistricts.size > 0) {
    throw new Error('A district was removed; a new human review is required.')
  }
}

const collectDifferences = (
  previousPack: PaidCurbReferencePack,
  currentPack: PaidCurbReferencePack,
) => {
  const previousRecords = buildRecordIndex(previousPack)
  const currentRecords = buildRecordIndex(currentPack)
  const differences: Omit<SourceDifference, 'reviewNote'>[] = []
  for (const [parkingSegmentId, previous] of previousRecords) {
    const current = currentRecords.get(parkingSegmentId)
    if (!current) {
      throw new Error(
        `Parking segment ${parkingSegmentId} was removed; a new human review is required.`,
      )
    }
    if (previous.districtId !== current.districtId) {
      throw new Error(
        `Parking segment ${parkingSegmentId} changed district; a new human review is required.`,
      )
    }
    for (const field of REVIEWABLE_FIELDS) {
      const previousValue = getRecordValue(previous.record, field)
      const currentValue = getRecordValue(current.record, field)
      if (previousValue !== currentValue) {
        differences.push({
          parkingSegmentId,
          districtId: current.districtId,
          field,
          previousValue,
          currentValue,
        })
      }
    }
    currentRecords.delete(parkingSegmentId)
  }
  if (currentRecords.size > 0) {
    throw new Error('A parking segment was added; a new human review is required.')
  }
  if (differences.length === 0) {
    throw new Error('Source SHA-256 changed without a reviewable semantic difference.')
  }
  return differences
}

const validateApprovals = (
  approvalRows: ApprovalRow[],
  differences: Omit<SourceDifference, 'reviewNote'>[],
) => {
  const approvals = new Map<string, ApprovalRow>()
  for (const [index, row] of approvalRows.entries()) {
    const segmentId = normalize(row.parking_segment_id)
    const field = normalize(row.field)
    const key = `${segmentId}:${field}`
    if (!segmentId || !REVIEWABLE_FIELDS.includes(field as ReviewableField)) {
      throw new Error(`Approval row ${index + 2} has an invalid segment or field.`)
    }
    if (approvals.has(key)) {
      throw new Error(`Approval file contains duplicate decision ${key}.`)
    }
    if (normalize(row.decision).toUpperCase() !== ACCEPT_DECISION) {
      throw new Error(
        `Approval row ${index + 2} must explicitly use ${ACCEPT_DECISION}.`,
      )
    }
    approvals.set(key, row)
  }

  const approvedDifferences = differences.map((difference) => {
    const key = `${difference.parkingSegmentId}:${difference.field}`
    const approval = approvals.get(key)
    if (!approval) {
      throw new Error(`Source difference ${key} has no human approval.`)
    }
    if (
      normalize(approval.approved_source_text) !== difference.previousValue ||
      normalize(approval.current_tdx_text) !== difference.currentValue
    ) {
      throw new Error(`Approval values do not exactly match source difference ${key}.`)
    }
    approvals.delete(key)
    return {
      ...difference,
      reviewNote: normalize(approval.review_note),
    }
  })
  if (approvals.size > 0) {
    throw new Error(
      `Approval file contains decisions unrelated to this source change: ${[
        ...approvals.keys(),
      ].join(', ')}.`,
    )
  }
  return approvedDifferences
}

export const migrateTaoyuanPaidCurbReviewSource = async (
  options: MigrateTaoyuanPaidCurbReviewSourceOptions = {},
) => {
  const previousReferencePath = path.resolve(
    options.previousReferencePath ?? DEFAULT_PREVIOUS_REFERENCE,
  )
  const currentReferencePath = path.resolve(
    options.currentReferencePath ?? DEFAULT_CURRENT_REFERENCE,
  )
  const evidenceDir = path.resolve(options.evidenceDir ?? DEFAULT_EVIDENCE_DIR)
  const approvalPath = path.resolve(options.approvalPath ?? DEFAULT_APPROVAL)
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR)
  const receiptPath = path.resolve(options.receiptPath ?? DEFAULT_RECEIPT)
  const [previousReference, currentReference, approvalBuffer] =
    await Promise.all([
      readReference(previousReferencePath),
      readReference(currentReferencePath),
      fs.readFile(approvalPath),
    ])

  validatePackShape(previousReference.pack, currentReference.pack)
  const differences = validateApprovals(
    parseCsv(approvalBuffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
    }) as ApprovalRow[],
    collectDifferences(previousReference.pack, currentReference.pack),
  )
  const previousRowsById = new Map<string, CsvRow>()
  for (const district of previousReference.pack.districts.filter(
    ({ recordCount }) => recordCount > 0,
  )) {
    const rows = await readApprovedEvidence({
      pack: previousReference.pack,
      districtId: district.districtId,
      evidenceDir,
    })
    for (const row of rows) {
      previousRowsById.set(normalize(row.parking_segment_id), row)
    }
  }

  await fs.mkdir(outputDir, { recursive: true })
  const migratedDistricts: TaoyuanPaidCurbSourceMigrationReceipt['migratedDistricts'] =
    []
  for (const district of currentReference.pack.districts.filter(
    ({ recordCount }) => recordCount > 0,
  )) {
    const rows = district.records.map((record): CsvRow => {
      const previousRow = previousRowsById.get(record.parkingSegmentId)
      if (!previousRow) {
        throw new Error(
          `${district.districtId}: no approved evidence exists for ${record.parkingSegmentId}.`,
        )
      }
      return {
        parking_segment_id: record.parkingSegmentId,
        district_id: district.districtId,
        district_name: district.districtName,
        description: record.description,
        fare_description: record.fareDescription ?? '',
        has_charging_point: String(record.hasChargingPoint),
        geometry_available: 'false',
        legal_answer_eligible: 'false',
        source_text_review_status: previousRow.source_text_review_status,
        source_text_review_note: previousRow.source_text_review_note,
      }
    })
    const baseName = `${district.districtId}-paid-curb-review`
    const reviewBuffer = Buffer.from(serializeReviewCsv(rows), 'utf-8')
    const manifest: ReviewManifest = {
      schemaVersion: 1,
      districtId: district.districtId,
      sourceSha256: currentReference.pack.source.sha256,
      sourceRecordCount: currentReference.pack.source.recordCount,
      reviewRecordCount: district.recordCount,
      geometryAvailable: false,
      legalAnswerEligible: false,
      allowedStatuses: ALLOWED_STATUSES,
      reviewCsv: `${baseName}.csv`,
    }
    const validation = validateTaoyuanPaidCurbReview({
      pack: currentReference.pack,
      manifest,
      rows,
      districtId: district.districtId,
      requireApproved: true,
    })
    if (!validation.pass || !validation.approved) {
      throw new Error(
        `${district.districtId}: migrated evidence failed validation:\n${validation.errors.join('\n')}`,
      )
    }
    await Promise.all([
      fs.writeFile(path.join(outputDir, `${baseName}.csv`), reviewBuffer),
      fs.writeFile(
        path.join(outputDir, `${baseName}.manifest.json`),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf-8',
      ),
    ])
    migratedDistricts.push({
      districtId: district.districtId,
      approvedRows: rows.length,
      reviewSha256: sha256TaoyuanReviewCsv(reviewBuffer),
    })
  }

  const receipt: TaoyuanPaidCurbSourceMigrationReceipt = {
    schemaVersion: 1,
    migratedAt: (options.now ?? new Date()).toISOString(),
    previousReferencePath: portablePath(previousReferencePath),
    currentReferencePath: portablePath(currentReferencePath),
    evidenceDir: portablePath(evidenceDir),
    outputDir: portablePath(outputDir),
    approval: {
      path: portablePath(approvalPath),
      sha256: sha256(approvalBuffer),
      decision: ACCEPT_DECISION,
    },
    source: {
      previousSha256: previousReference.pack.source.sha256,
      currentSha256: currentReference.pack.source.sha256,
      recordCount: currentReference.pack.source.recordCount,
    },
    differences,
    migratedDistricts,
    totalApprovedRows: migratedDistricts.reduce(
      (total, district) => total + district.approvedRows,
      0,
    ),
    safety: {
      geometryAvailable: false,
      legalAnswerEligible: false,
    },
  }
  await fs.mkdir(path.dirname(receiptPath), { recursive: true })
  await fs.writeFile(
    receiptPath,
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf-8',
  )
  return { receipt, receiptPath }
}

const getArgValue = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const run = async () => {
  const result = await migrateTaoyuanPaidCurbReviewSource({
    previousReferencePath:
      getArgValue(process.argv, '--previous-reference') ?? undefined,
    currentReferencePath:
      getArgValue(process.argv, '--current-reference') ?? undefined,
    evidenceDir: getArgValue(process.argv, '--evidence-dir') ?? undefined,
    approvalPath: getArgValue(process.argv, '--approval') ?? undefined,
    outputDir: getArgValue(process.argv, '--out-dir') ?? undefined,
    receiptPath: getArgValue(process.argv, '--receipt') ?? undefined,
  })
  console.log(
    `Migrated ${result.receipt.totalApprovedRows} approved rows across ${result.receipt.migratedDistricts.length} districts.`,
  )
  console.log(
    `Approved source differences: ${result.receipt.differences.length}`,
  )
  console.log(`Current source SHA-256: ${result.receipt.source.currentSha256}`)
  console.log(`Receipt: ${result.receiptPath}`)
  console.log('Geometry and legal-answer eligibility remain false.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
