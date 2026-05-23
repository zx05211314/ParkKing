import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import { VALID_QA_REVIEW_STATUSES } from './qaReviewSummaryTypes'
import type { QaReviewApplyParams, QaReviewApplyResult } from './qaReviewApplyTypes'
import { REVIEW_TIMESTAMP_MESSAGE, isValidReviewTimestamp } from './reviewTimestamp'

interface CsvTable {
  headers: string[]
  rows: string[][]
}

interface SourceReviewManifest {
  path: string
  csvPath: string | null
  datasetHash: string | null
  configHash: string | null
  rowsTotal: number | null
  payload: Record<string, unknown>
}

interface ReviewUpdate {
  sourceRowNumber: number
  sourceIndex: number
  status: string
  note: string
  createdAt: string
}

interface BuildUpdatesResult {
  updates: ReviewUpdate[]
  skippedBlankRows: number
  sourceStatusIndex: number
  sourceNoteIndex: number
  sourceCreatedAtIndex: number
  sourceReviewSourceIndex: number
}

const parseCsvTable = (raw: string, label: string): CsvTable => {
  const records = parseCsv(raw, {
    bom: true,
    skip_empty_lines: true,
  }) as string[][]
  const headers = records[0] ?? []
  if (headers.length === 0) {
    throw new Error(`${label} CSV has no header row.`)
  }
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

const ensureHeaderIndex = (table: CsvTable, header: string) => {
  const existing = findHeaderIndex(table.headers, [header])
  if (existing >= 0) {
    return existing
  }
  table.headers.push(header)
  table.rows.forEach((row) => row.push(''))
  return table.headers.length - 1
}

const requireHeaderIndex = (
  table: CsvTable,
  candidates: string[],
  label: string,
  errors: string[],
) => {
  const index = findHeaderIndex(table.headers, candidates)
  if (index < 0) {
    errors.push(`${label} CSV is missing required column ${candidates[0]}.`)
  }
  return index
}

const getCell = (row: string[], index: number) =>
  index >= 0 ? (row[index] ?? '').trim() : ''

const setCell = (row: string[], index: number, value: string) => {
  while (row.length <= index) {
    row.push('')
  }
  row[index] = value
}

const normalizeStatus = (value: string) => value.trim().toUpperCase()

const isValidReviewStatus = (value: string) =>
  VALID_QA_REVIEW_STATUSES.includes(value as never)

const parseSourceRowNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : NaN
}

const csvEscape = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

const stringifyCsvTable = (table: CsvTable) =>
  `${[table.headers, ...table.rows]
    .map((row) => row.map((value) => csvEscape(value ?? '')).join(','))
    .join('\n')}\n`

const sameIdentity = (left: string, right: string) => left.trim() === right.trim()

const adjacentManifestPath = (inputPath: string) => {
  const ext = path.extname(inputPath)
  const basePath = ext ? inputPath.slice(0, -ext.length) : inputPath
  return `${basePath}.manifest.json`
}

const isMissingFileError = (error: unknown) =>
  error instanceof Error && (error as { code?: unknown }).code === 'ENOENT'

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const getRecordString = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

const getRecordNumber = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const parseSourceManifest = (
  manifestPath: string,
  payload: unknown,
): SourceReviewManifest => {
  const record = toRecord(payload)
  const dataset = toRecord(record.dataset)
  const rows = toRecord(record.rows)
  return {
    path: manifestPath,
    csvPath: getRecordString(record, 'csvPath'),
    datasetHash: getRecordString(dataset, 'datasetHash'),
    configHash: getRecordString(dataset, 'configHash'),
    rowsTotal: getRecordNumber(rows, 'total'),
    payload: record,
  }
}

const loadAdjacentSourceManifest = async (
  sourcePath: string,
  sourceRowTotal: number,
  errors: string[],
) => {
  const manifestPath = adjacentManifestPath(sourcePath)
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8')
    const manifest = parseSourceManifest(manifestPath, JSON.parse(raw) as unknown)
    if (manifest.csvPath && path.resolve(manifest.csvPath) !== sourcePath) {
      errors.push(
        `Source review manifest csvPath ${manifest.csvPath} does not match source ${sourcePath}.`,
      )
    }
    if (manifest.rowsTotal !== null && manifest.rowsTotal !== sourceRowTotal) {
      errors.push(
        `Source review manifest row total ${manifest.rowsTotal} does not match source CSV row total ${sourceRowTotal}.`,
      )
    }
    return manifest
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }
    const reason = error instanceof Error ? error.message : String(error)
    errors.push(`Source review manifest not loaded from ${manifestPath}: ${reason}`)
    return null
  }
}

const validateProvenanceCell = ({
  value,
  expected,
  label,
  rowNumber,
  errors,
  sourceManifest,
}: {
  value: string
  expected: string | null
  label: string
  rowNumber: number
  errors: string[]
  sourceManifest: SourceReviewManifest | null
}) => {
  if (!value) {
    return
  }
  if (!sourceManifest || !expected) {
    errors.push(
      `Review handoff row ${rowNumber}: ${label} "${value}" cannot be verified because the source review manifest is missing that value.`,
    )
    return
  }
  if (value !== expected) {
    errors.push(
      `Review handoff row ${rowNumber}: ${label} "${value}" does not match source manifest "${expected}".`,
    )
  }
}

const buildReviewStatusCounts = (source: CsvTable, statusIndex: number) => {
  const counts: Record<string, number> = {}
  source.rows.forEach((row) => {
    const status = getCell(row, statusIndex) || 'pending'
    counts[status] = (counts[status] ?? 0) + 1
  })
  return counts
}

const buildReviewSourceCounts = (
  source: CsvTable,
  reviewSourceIndex: number,
  statusIndex: number,
) => {
  const counts: Record<string, number> = {}
  source.rows.forEach((row) => {
    const sourceValue = getCell(row, reviewSourceIndex)
    const fallback = getCell(row, statusIndex) ? 'manual' : 'pending'
    const key = sourceValue || fallback
    counts[key] = (counts[key] ?? 0) + 1
  })
  return counts
}

const buildMergedManifest = ({
  sourceManifest,
  source,
  outPath,
  reviewsPath,
  appliedRows,
  skippedBlankRows,
  statusIndex,
  reviewSourceIndex,
}: {
  sourceManifest: SourceReviewManifest
  source: CsvTable
  outPath: string
  reviewsPath: string
  appliedRows: number
  skippedBlankRows: number
  statusIndex: number
  reviewSourceIndex: number
}) => {
  const mergedManifest = structuredClone(sourceManifest.payload)
  mergedManifest.csvPath = outPath
  const rows = toRecord(mergedManifest.rows)
  rows.total = source.rows.length
  rows.reviewStatusCounts = buildReviewStatusCounts(source, statusIndex)
  rows.reviewSourceCounts = buildReviewSourceCounts(source, reviewSourceIndex, statusIndex)
  mergedManifest.rows = rows
  mergedManifest.appliedReview = {
    sourceCsvPath: sourceManifest.csvPath,
    sourceManifestPath: sourceManifest.path,
    reviewsPath,
    appliedAt: new Date().toISOString(),
    appliedRows,
    skippedBlankRows,
  }
  return mergedManifest
}

const writeMergedManifest = async ({
  sourceManifest,
  source,
  outPath,
  reviewsPath,
  appliedRows,
  skippedBlankRows,
  statusIndex,
  reviewSourceIndex,
}: {
  sourceManifest: SourceReviewManifest
  source: CsvTable
  outPath: string
  reviewsPath: string
  appliedRows: number
  skippedBlankRows: number
  statusIndex: number
  reviewSourceIndex: number
}) => {
  const manifestPath = adjacentManifestPath(outPath)
  const mergedManifest = buildMergedManifest({
    sourceManifest,
    source,
    outPath,
    reviewsPath,
    appliedRows,
    skippedBlankRows,
    statusIndex,
    reviewSourceIndex,
  })
  await fs.writeFile(manifestPath, `${JSON.stringify(mergedManifest, null, 2)}\n`, 'utf-8')
  return manifestPath
}

const buildUpdates = ({
  source,
  reviews,
  allowOverwrite,
  sourceManifest,
  errors,
}: {
  source: CsvTable
  reviews: CsvTable
  allowOverwrite: boolean
  sourceManifest: SourceReviewManifest | null
  errors: string[]
}): BuildUpdatesResult => {
  const sourceDistrictIndex = requireHeaderIndex(
    source,
    ['districtId', 'district_id', 'district'],
    'Source',
    errors,
  )
  const sourceSegmentIndex = requireHeaderIndex(
    source,
    ['segmentId', 'segment_id', 'segment'],
    'Source',
    errors,
  )
  const sourceStatusIndex = ensureHeaderIndex(source, 'reviewStatus')
  const sourceNoteIndex = ensureHeaderIndex(source, 'reviewNote')
  const sourceCreatedAtIndex = ensureHeaderIndex(source, 'createdAt')
  const sourceReviewSourceIndex = ensureHeaderIndex(source, 'reviewSource')
  const sourceBucketIndex = findHeaderIndex(source.headers, [
    'reviewBucket',
    'bucket',
    'sampleBucket',
  ])

  const reviewRowNumberIndex = requireHeaderIndex(
    reviews,
    ['sourceRowNumber'],
    'Review handoff',
    errors,
  )
  const reviewDistrictIndex = requireHeaderIndex(
    reviews,
    ['districtId', 'district_id', 'district'],
    'Review handoff',
    errors,
  )
  const reviewSegmentIndex = requireHeaderIndex(
    reviews,
    ['segmentId', 'segment_id', 'segment'],
    'Review handoff',
    errors,
  )
  const reviewStatusIndex = requireHeaderIndex(
    reviews,
    ['reviewStatus', 'status', 'overrideStatus', 'signOverrideStatus'],
    'Review handoff',
    errors,
  )
  const reviewNoteIndex = findHeaderIndex(reviews.headers, [
    'reviewNote',
    'note',
    'overrideNote',
  ])
  const reviewCreatedAtIndex = findHeaderIndex(reviews.headers, [
    'createdAt',
    'reviewedAt',
    'verifiedAt',
  ])
  const reviewBucketIndex = findHeaderIndex(reviews.headers, [
    'reviewBucket',
    'bucket',
    'sampleBucket',
  ])
  const reviewDatasetHashIndex = findHeaderIndex(reviews.headers, [
    'sourceDatasetHash',
    'datasetHash',
  ])
  const reviewConfigHashIndex = findHeaderIndex(reviews.headers, [
    'sourceConfigHash',
    'configHash',
  ])
  const reviewRowsTotalIndex = findHeaderIndex(reviews.headers, [
    'sourceRowsTotal',
    'rowsTotal',
  ])

  const updates: ReviewUpdate[] = []
  const seenSourceRows = new Set<number>()
  let skippedBlankRows = 0

  if (errors.length > 0) {
    return {
      updates,
      skippedBlankRows,
      sourceStatusIndex,
      sourceNoteIndex,
      sourceCreatedAtIndex,
      sourceReviewSourceIndex,
    }
  }

  reviews.rows.forEach((reviewRow, index) => {
    const reviewCsvRowNumber = index + 2
    const rawStatus = getCell(reviewRow, reviewStatusIndex)
    if (!rawStatus) {
      skippedBlankRows += 1
      return
    }

    const status = normalizeStatus(rawStatus)
    if (!isValidReviewStatus(status)) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: invalid reviewStatus "${rawStatus}" (expected LEGAL, ILLEGAL, or UNCLEAR).`,
      )
      return
    }

    validateProvenanceCell({
      value: getCell(reviewRow, reviewDatasetHashIndex),
      expected: sourceManifest?.datasetHash ?? null,
      label: 'sourceDatasetHash',
      rowNumber: reviewCsvRowNumber,
      errors,
      sourceManifest,
    })
    validateProvenanceCell({
      value: getCell(reviewRow, reviewConfigHashIndex),
      expected: sourceManifest?.configHash ?? null,
      label: 'sourceConfigHash',
      rowNumber: reviewCsvRowNumber,
      errors,
      sourceManifest,
    })
    const rawRowsTotal = getCell(reviewRow, reviewRowsTotalIndex)
    if (rawRowsTotal) {
      const reviewRowsTotal = Number(rawRowsTotal)
      if (!Number.isInteger(reviewRowsTotal) || reviewRowsTotal < 0) {
        errors.push(
          `Review handoff row ${reviewCsvRowNumber}: sourceRowsTotal must be a non-negative integer.`,
        )
        return
      }
      if (reviewRowsTotal !== source.rows.length) {
        errors.push(
          `Review handoff row ${reviewCsvRowNumber}: sourceRowsTotal ${reviewRowsTotal} does not match source CSV row total ${source.rows.length}.`,
        )
        return
      }
      if (
        sourceManifest?.rowsTotal !== null &&
        sourceManifest?.rowsTotal !== undefined &&
        reviewRowsTotal !== sourceManifest.rowsTotal
      ) {
        errors.push(
          `Review handoff row ${reviewCsvRowNumber}: sourceRowsTotal ${reviewRowsTotal} does not match source manifest row total ${sourceManifest.rowsTotal}.`,
        )
        return
      }
    }

    const sourceRowNumber = parseSourceRowNumber(getCell(reviewRow, reviewRowNumberIndex))
    if (!Number.isInteger(sourceRowNumber) || sourceRowNumber < 2) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: sourceRowNumber must be an integer >= 2.`,
      )
      return
    }
    if (seenSourceRows.has(sourceRowNumber)) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: duplicate sourceRowNumber ${sourceRowNumber}.`,
      )
      return
    }
    seenSourceRows.add(sourceRowNumber)

    const sourceIndex = sourceRowNumber - 2
    const sourceRow = source.rows[sourceIndex]
    if (!sourceRow) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: sourceRowNumber ${sourceRowNumber} is outside the source CSV.`,
      )
      return
    }

    const reviewDistrictId = getCell(reviewRow, reviewDistrictIndex)
    const reviewSegmentId = getCell(reviewRow, reviewSegmentIndex)
    if (!reviewDistrictId || !reviewSegmentId) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: districtId and segmentId are required when reviewStatus is set.`,
      )
      return
    }
    const sourceDistrictId = getCell(sourceRow, sourceDistrictIndex)
    const sourceSegmentId = getCell(sourceRow, sourceSegmentIndex)
    if (
      !sameIdentity(reviewDistrictId, sourceDistrictId) ||
      !sameIdentity(reviewSegmentId, sourceSegmentId)
    ) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: identity ${reviewDistrictId}/${reviewSegmentId} does not match source row ${sourceRowNumber} ${sourceDistrictId}/${sourceSegmentId}.`,
      )
      return
    }

    if (sourceBucketIndex >= 0 && reviewBucketIndex >= 0) {
      const reviewBucket = getCell(reviewRow, reviewBucketIndex)
      const sourceBucket = getCell(sourceRow, sourceBucketIndex)
      if (reviewBucket && sourceBucket && !sameIdentity(reviewBucket, sourceBucket)) {
        errors.push(
          `Review handoff row ${reviewCsvRowNumber}: reviewBucket ${reviewBucket} does not match source row ${sourceRowNumber} bucket ${sourceBucket}.`,
        )
        return
      }
    }

    const existingStatus = getCell(sourceRow, sourceStatusIndex)
    if (existingStatus && !allowOverwrite) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: source row ${sourceRowNumber} already has reviewStatus ${existingStatus}; rerun with --allow-overwrite to replace it.`,
      )
      return
    }

    const note = getCell(reviewRow, reviewNoteIndex)
    const createdAt = getCell(reviewRow, reviewCreatedAtIndex)
    if (!note || !createdAt) {
      errors.push(
        `Review handoff row ${reviewCsvRowNumber}: reviewNote and createdAt are required when reviewStatus is set.`,
      )
      return
    }
    if (!isValidReviewTimestamp(createdAt)) {
      errors.push(`Review handoff row ${reviewCsvRowNumber}: ${REVIEW_TIMESTAMP_MESSAGE}.`)
      return
    }

    updates.push({
      sourceRowNumber,
      sourceIndex,
      status,
      note,
      createdAt,
    })
  })

  if (updates.length === 0 && errors.length === 0) {
    errors.push('No reviewed rows found in review handoff CSV. Fill reviewStatus before applying.')
  }

  return {
    updates,
    skippedBlankRows,
    sourceStatusIndex,
    sourceNoteIndex,
    sourceCreatedAtIndex,
    sourceReviewSourceIndex,
  }
}

export const applyQaReviewHandoff = async ({
  sourcePath,
  reviewsPath,
  outPath,
  allowOverwrite = false,
}: QaReviewApplyParams): Promise<QaReviewApplyResult> => {
  const resolvedSourcePath = path.resolve(sourcePath)
  const resolvedReviewsPath = path.resolve(reviewsPath)
  const resolvedOutPath = path.resolve(outPath)
  const errors: string[] = []
  const warnings: string[] = []
  let manifestPath: string | null = null

  const source = parseCsvTable(await fs.readFile(resolvedSourcePath, 'utf-8'), 'Source')
  const reviews = parseCsvTable(await fs.readFile(resolvedReviewsPath, 'utf-8'), 'Review handoff')
  const sourceManifest = await loadAdjacentSourceManifest(
    resolvedSourcePath,
    source.rows.length,
    errors,
  )
  const updateState = buildUpdates({
    source,
    reviews,
    allowOverwrite,
    sourceManifest,
    errors,
  })

  if (errors.length === 0) {
    updateState.updates.forEach((update) => {
      const sourceRow = source.rows[update.sourceIndex]
      setCell(sourceRow, updateState.sourceStatusIndex, update.status)
      setCell(sourceRow, updateState.sourceNoteIndex, update.note)
      setCell(sourceRow, updateState.sourceCreatedAtIndex, update.createdAt)
      setCell(sourceRow, updateState.sourceReviewSourceIndex, 'manual')
    })
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true })
    await fs.writeFile(resolvedOutPath, stringifyCsvTable(source), 'utf-8')
    if (sourceManifest) {
      manifestPath = await writeMergedManifest({
        sourceManifest,
        source,
        outPath: resolvedOutPath,
        reviewsPath: resolvedReviewsPath,
        appliedRows: updateState.updates.length,
        skippedBlankRows: updateState.skippedBlankRows,
        statusIndex: updateState.sourceStatusIndex,
        reviewSourceIndex: updateState.sourceReviewSourceIndex,
      })
    } else {
      warnings.push('Source review manifest was not found; merged manifest was not written.')
    }
  }

  if (updateState.skippedBlankRows > 0) {
    warnings.push(
      `${updateState.skippedBlankRows} handoff row(s) have blank reviewStatus and were skipped.`,
    )
  }

  return {
    sourcePath: resolvedSourcePath,
    reviewsPath: resolvedReviewsPath,
    outPath: resolvedOutPath,
    manifestPath,
    totalReviewRows: reviews.rows.length,
    reviewedInputRows: updateState.updates.length,
    skippedBlankRows: updateState.skippedBlankRows,
    appliedRows: errors.length === 0 ? updateState.updates.length : 0,
    errors,
    warnings,
    pass: errors.length === 0,
  }
}
