import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import type {
  QaReviewChecklistParams,
  QaReviewChecklistProvenance,
  QaReviewChecklistResult,
  QaReviewChecklistRow,
} from './qaReviewChecklistTypes'
import { VALID_QA_REVIEW_STATUSES } from './qaReviewSummaryTypes'
import { REVIEW_TIMESTAMP_MESSAGE, isValidReviewTimestamp } from './reviewTimestamp'

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

const requireHeaderIndex = (
  table: CsvTable,
  candidates: string[],
  errors: string[],
) => {
  const index = findHeaderIndex(table.headers, candidates)
  if (index < 0) {
    errors.push(`Next-review CSV is missing required column ${candidates[0]}.`)
  }
  return index
}

const getCell = (row: string[], index: number) =>
  index >= 0 ? (row[index] ?? '').trim() : ''

const getNullableCell = (row: string[], index: number) => getCell(row, index) || null

const getUniqueCellValue = (
  rows: QaReviewChecklistRow[],
  pick: (row: QaReviewChecklistRow) => string | null,
  label: string,
  errors: string[],
) => {
  const values = rows
    .map(pick)
    .filter((value): value is string => value !== null && value.trim().length > 0)
  const uniqueValues = [...new Set(values)]
  if (uniqueValues.length > 1) {
    errors.push(
      `Next-review CSV has mixed ${label} values: ${uniqueValues.join(', ')}.`,
    )
  }
  return uniqueValues[0] ?? null
}

const validateRows = (rows: QaReviewChecklistRow[], errors: string[], warnings: string[]) => {
  const seenSourceRows = new Set<string>()

  rows.forEach((row) => {
    if (!row.sourceRowNumber || !row.districtId || !row.segmentId || !row.reviewBucket) {
      errors.push(
        `Next-review CSV row ${row.rowNumber} is missing sourceRowNumber, districtId, segmentId, or reviewBucket.`,
      )
    }
    if (row.sourceRowNumber) {
      if (seenSourceRows.has(row.sourceRowNumber)) {
        errors.push(
          `Next-review CSV row ${row.rowNumber} duplicates sourceRowNumber ${row.sourceRowNumber}.`,
        )
      }
      seenSourceRows.add(row.sourceRowNumber)
    }
    if (
      row.reviewStatus &&
      !VALID_QA_REVIEW_STATUSES.includes(row.reviewStatus.toUpperCase() as never)
    ) {
      errors.push(
        `Next-review CSV row ${row.rowNumber} has invalid reviewStatus ${row.reviewStatus}; expected LEGAL, ILLEGAL, or UNCLEAR.`,
      )
    }
    if (row.reviewStatus && (!row.reviewNote || !row.createdAt)) {
      errors.push(
        `Next-review CSV row ${row.rowNumber} has reviewStatus but is missing reviewNote or createdAt.`,
      )
    }
    if (row.reviewStatus && row.reviewNote && row.createdAt && !isValidReviewTimestamp(row.createdAt)) {
      errors.push(
        `Next-review CSV row ${row.rowNumber} has reviewStatus but ${REVIEW_TIMESTAMP_MESSAGE}.`,
      )
    }
  })

  const rowsWithStatus = rows.filter((row) => row.reviewStatus).length
  if (rowsWithStatus > 0) {
    warnings.push(
      `${rowsWithStatus} row(s) already have reviewStatus; checklist generation verifies status/note/timestamp shape but does not apply them.`,
    )
  }
}

const buildRows = (table: CsvTable, errors: string[]) => {
  const sourceRowNumberIndex = requireHeaderIndex(table, ['sourceRowNumber'], errors)
  const districtIndex = requireHeaderIndex(
    table,
    ['districtId', 'district_id', 'district'],
    errors,
  )
  const segmentIndex = requireHeaderIndex(
    table,
    ['segmentId', 'segment_id', 'segment'],
    errors,
  )
  const bucketIndex = requireHeaderIndex(
    table,
    ['reviewBucket', 'bucket', 'sampleBucket'],
    errors,
  )
  const statusIndex = requireHeaderIndex(
    table,
    ['reviewStatus', 'status', 'overrideStatus', 'signOverrideStatus'],
    errors,
  )
  const latIndex = findHeaderIndex(table.headers, ['lat', 'latitude'])
  const lonIndex = findHeaderIndex(table.headers, ['lon', 'lng', 'longitude'])
  const scoreIndex = findHeaderIndex(table.headers, ['score'])
  const tierIndex = findHeaderIndex(table.headers, ['tier'])
  const allowedNowIndex = findHeaderIndex(table.headers, ['allowedNow', 'action'])
  const curbMarkingIndex = findHeaderIndex(table.headers, [
    'curbMarking',
    'curb_marking',
  ])
  const sourceTypeIndex = findHeaderIndex(table.headers, ['sourceType', 'source_type'])
  const sourceReliabilityIndex = findHeaderIndex(table.headers, [
    'sourceReliability',
    'source_reliability',
  ])
  const dataFreshnessDaysIndex = findHeaderIndex(table.headers, [
    'dataFreshnessDays',
    'freshnessDays',
    'sourceFreshnessDays',
  ])
  const finalConfidenceIndex = findHeaderIndex(table.headers, [
    'finalConfidence',
    'final_confidence',
  ])
  const coverageConfidenceIndex = findHeaderIndex(table.headers, [
    'coverageConfidence',
    'coverage_confidence',
  ])
  const overrideConfidenceIndex = findHeaderIndex(table.headers, [
    'overrideConfidence',
    'override_confidence',
  ])
  const parkingSpaceCountIndex = findHeaderIndex(table.headers, [
    'parkingSpaceCount',
    'parking_spaces',
  ])
  const topReasonsIndex = findHeaderIndex(table.headers, [
    'topReasons',
    'topReasons[]',
    'reasonCodes',
    'reasons',
  ])
  const flagsIndex = findHeaderIndex(table.headers, ['flags', 'reviewFlags'])
  const riskTagsIndex = findHeaderIndex(table.headers, ['riskTags', 'risk_tags'])
  const signOverrideStatusIndex = findHeaderIndex(table.headers, [
    'signOverrideStatus',
    'sign_override_status',
  ])
  const signOverrideSourceIndex = findHeaderIndex(table.headers, [
    'signOverrideSource',
    'sign_override_source',
  ])
  const signOverrideVerifiedAtIndex = findHeaderIndex(table.headers, [
    'signOverrideVerifiedAt',
    'sign_override_verified_at',
  ])
  const signOverrideNoteIndex = findHeaderIndex(table.headers, [
    'signOverrideNote',
    'sign_override_note',
  ])
  const mapsUrlIndex = findHeaderIndex(table.headers, ['mapsUrl', 'mapUrl'])
  const streetViewUrlIndex = findHeaderIndex(table.headers, [
    'streetViewUrl',
    'street_view_url',
  ])
  const datasetHashIndex = findHeaderIndex(table.headers, [
    'sourceDatasetHash',
    'datasetHash',
  ])
  const configHashIndex = findHeaderIndex(table.headers, [
    'sourceConfigHash',
    'configHash',
  ])
  const rowsTotalIndex = findHeaderIndex(table.headers, ['sourceRowsTotal', 'rowsTotal'])
  const planRankIndex = findHeaderIndex(table.headers, ['reviewPlanRank'])
  const planReasonIndex = findHeaderIndex(table.headers, ['reviewPlanReason'])
  const noteIndex = findHeaderIndex(table.headers, ['reviewNote', 'note', 'overrideNote'])
  const createdAtIndex = findHeaderIndex(table.headers, [
    'createdAt',
    'reviewedAt',
    'verifiedAt',
  ])

  if (errors.length > 0) {
    return []
  }

  return table.rows.map((row, index): QaReviewChecklistRow => ({
    rowNumber: index + 2,
    sourceRowNumber: getCell(row, sourceRowNumberIndex),
    districtId: getCell(row, districtIndex),
    segmentId: getCell(row, segmentIndex),
    reviewBucket: getCell(row, bucketIndex),
    lat: getNullableCell(row, latIndex),
    lon: getNullableCell(row, lonIndex),
    score: getNullableCell(row, scoreIndex),
    tier: getNullableCell(row, tierIndex),
    allowedNow: getNullableCell(row, allowedNowIndex),
    curbMarking: getNullableCell(row, curbMarkingIndex),
    sourceType: getNullableCell(row, sourceTypeIndex),
    sourceReliability: getNullableCell(row, sourceReliabilityIndex),
    dataFreshnessDays: getNullableCell(row, dataFreshnessDaysIndex),
    finalConfidence: getNullableCell(row, finalConfidenceIndex),
    coverageConfidence: getNullableCell(row, coverageConfidenceIndex),
    overrideConfidence: getNullableCell(row, overrideConfidenceIndex),
    parkingSpaceCount: getNullableCell(row, parkingSpaceCountIndex),
    topReasons: getNullableCell(row, topReasonsIndex),
    flags: getNullableCell(row, flagsIndex),
    riskTags: getNullableCell(row, riskTagsIndex),
    signOverrideStatus: getNullableCell(row, signOverrideStatusIndex),
    signOverrideSource: getNullableCell(row, signOverrideSourceIndex),
    signOverrideVerifiedAt: getNullableCell(row, signOverrideVerifiedAtIndex),
    signOverrideNote: getNullableCell(row, signOverrideNoteIndex),
    mapsUrl: getNullableCell(row, mapsUrlIndex),
    streetViewUrl: getNullableCell(row, streetViewUrlIndex),
    sourceDatasetHash: getNullableCell(row, datasetHashIndex),
    sourceConfigHash: getNullableCell(row, configHashIndex),
    sourceRowsTotal: getNullableCell(row, rowsTotalIndex),
    reviewPlanRank: getNullableCell(row, planRankIndex),
    reviewPlanReason: getNullableCell(row, planReasonIndex),
    reviewStatus: getNullableCell(row, statusIndex),
    reviewNote: getNullableCell(row, noteIndex),
    createdAt: getNullableCell(row, createdAtIndex),
  }))
}

const buildProvenance = (
  rows: QaReviewChecklistRow[],
  errors: string[],
): QaReviewChecklistProvenance => ({
  sourceDatasetHash: getUniqueCellValue(
    rows,
    (row) => row.sourceDatasetHash,
    'sourceDatasetHash',
    errors,
  ),
  sourceConfigHash: getUniqueCellValue(
    rows,
    (row) => row.sourceConfigHash,
    'sourceConfigHash',
    errors,
  ),
  sourceRowsTotal: getUniqueCellValue(
    rows,
    (row) => row.sourceRowsTotal,
    'sourceRowsTotal',
    errors,
  ),
})

export const buildQaReviewChecklist = async ({
  inputPath,
  sourcePath,
  outPath,
  mergedOutPath,
  configPath,
  title,
}: QaReviewChecklistParams): Promise<QaReviewChecklistResult> => {
  const resolvedInputPath = path.resolve(inputPath)
  const resolvedSourcePath = sourcePath ? path.resolve(sourcePath) : null
  const resolvedOutPath = outPath ? path.resolve(outPath) : null
  const resolvedMergedOutPath = mergedOutPath ? path.resolve(mergedOutPath) : null
  const resolvedConfigPath = configPath ? path.resolve(configPath) : null
  const errors: string[] = []
  const warnings: string[] = []
  const raw = await fs.readFile(resolvedInputPath, 'utf-8')
  const table = parseCsvTable(raw)

  if (table.headers.length === 0) {
    errors.push('Next-review CSV has no header row.')
  }
  if (table.rows.length === 0) {
    errors.push('Next-review CSV has no handoff rows.')
  }

  const rows = table.headers.length > 0 ? buildRows(table, errors) : []
  validateRows(rows, errors, warnings)
  const provenance = buildProvenance(rows, errors)

  return {
    inputPath: resolvedInputPath,
    sourcePath: resolvedSourcePath,
    outPath: resolvedOutPath,
    mergedOutPath: resolvedMergedOutPath,
    configPath: resolvedConfigPath,
    title: title?.trim() || 'QA review checklist',
    totalRows: rows.length,
    rowsWithReviewStatus: rows.filter((row) => row.reviewStatus).length,
    provenance,
    rows,
    errors,
    warnings,
    pass: errors.length === 0,
  }
}
