import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import type { Feature, Point } from 'geojson'
import type { QaReviewGeojsonParams, QaReviewGeojsonResult } from './qaReviewGeojsonTypes'
import { isValidReviewTimestamp } from './reviewTimestamp'

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

const parseCoordinate = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const addOptionalProperty = (
  properties: Record<string, string | number>,
  key: string,
  value: string,
) => {
  if (value) {
    properties[key] = value
  }
}

export const buildQaReviewGeojson = async ({
  inputPath,
  outPath,
}: QaReviewGeojsonParams): Promise<QaReviewGeojsonResult> => {
  const resolvedInputPath = path.resolve(inputPath)
  const resolvedOutPath = outPath ? path.resolve(outPath) : null
  const errors: string[] = []
  const warnings: string[] = []
  const table = parseCsvTable(await fs.readFile(resolvedInputPath, 'utf-8'))

  if (table.headers.length === 0) {
    errors.push('Next-review CSV has no header row.')
  }
  if (table.rows.length === 0) {
    errors.push('Next-review CSV has no handoff rows.')
  }

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
  const latIndex = requireHeaderIndex(table, ['lat', 'latitude'], errors)
  const lonIndex = requireHeaderIndex(table, ['lon', 'lng', 'longitude'], errors)
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
  const planRankIndex = findHeaderIndex(table.headers, ['reviewPlanRank'])
  const planReasonIndex = findHeaderIndex(table.headers, ['reviewPlanReason'])
  const statusIndex = findHeaderIndex(table.headers, [
    'reviewStatus',
    'status',
    'overrideStatus',
    'signOverrideStatus',
  ])
  const noteIndex = findHeaderIndex(table.headers, ['reviewNote', 'note', 'overrideNote'])
  const createdAtIndex = findHeaderIndex(table.headers, [
    'createdAt',
    'reviewedAt',
    'verifiedAt',
  ])

  const features: Feature<Point>[] = []
  let skippedRows = 0

  if (errors.length === 0) {
    table.rows.forEach((row, index) => {
      const csvRowNumber = index + 2
      const lat = parseCoordinate(getCell(row, latIndex))
      const lon = parseCoordinate(getCell(row, lonIndex))
      if (lat === null || lon === null) {
        skippedRows += 1
        warnings.push(
          `Next-review CSV row ${csvRowNumber} has invalid lat/lon and was skipped.`,
        )
        return
      }

      const properties: Record<string, string | number> = {
        csvRowNumber,
        sourceRowNumber: getCell(row, sourceRowNumberIndex),
        districtId: getCell(row, districtIndex),
        segmentId: getCell(row, segmentIndex),
        reviewBucket: getCell(row, bucketIndex),
      }
      addOptionalProperty(properties, 'score', getCell(row, scoreIndex))
      addOptionalProperty(properties, 'tier', getCell(row, tierIndex))
      addOptionalProperty(properties, 'allowedNow', getCell(row, allowedNowIndex))
      addOptionalProperty(properties, 'curbMarking', getCell(row, curbMarkingIndex))
      addOptionalProperty(properties, 'sourceType', getCell(row, sourceTypeIndex))
      addOptionalProperty(
        properties,
        'sourceReliability',
        getCell(row, sourceReliabilityIndex),
      )
      addOptionalProperty(
        properties,
        'dataFreshnessDays',
        getCell(row, dataFreshnessDaysIndex),
      )
      addOptionalProperty(
        properties,
        'finalConfidence',
        getCell(row, finalConfidenceIndex),
      )
      addOptionalProperty(
        properties,
        'coverageConfidence',
        getCell(row, coverageConfidenceIndex),
      )
      addOptionalProperty(
        properties,
        'overrideConfidence',
        getCell(row, overrideConfidenceIndex),
      )
      addOptionalProperty(
        properties,
        'parkingSpaceCount',
        getCell(row, parkingSpaceCountIndex),
      )
      addOptionalProperty(properties, 'topReasons', getCell(row, topReasonsIndex))
      addOptionalProperty(properties, 'flags', getCell(row, flagsIndex))
      addOptionalProperty(properties, 'riskTags', getCell(row, riskTagsIndex))
      addOptionalProperty(
        properties,
        'signOverrideStatus',
        getCell(row, signOverrideStatusIndex),
      )
      addOptionalProperty(
        properties,
        'signOverrideSource',
        getCell(row, signOverrideSourceIndex),
      )
      addOptionalProperty(
        properties,
        'signOverrideVerifiedAt',
        getCell(row, signOverrideVerifiedAtIndex),
      )
      addOptionalProperty(
        properties,
        'signOverrideNote',
        getCell(row, signOverrideNoteIndex),
      )
      addOptionalProperty(properties, 'mapsUrl', getCell(row, mapsUrlIndex))
      addOptionalProperty(properties, 'streetViewUrl', getCell(row, streetViewUrlIndex))
      addOptionalProperty(properties, 'reviewPlanRank', getCell(row, planRankIndex))
      addOptionalProperty(properties, 'reviewPlanReason', getCell(row, planReasonIndex))
      const reviewStatus = getCell(row, statusIndex)
      const reviewNote = getCell(row, noteIndex)
      const createdAt = getCell(row, createdAtIndex)
      addOptionalProperty(properties, 'reviewStatus', reviewStatus)
      addOptionalProperty(properties, 'reviewNote', reviewNote)
      addOptionalProperty(properties, 'createdAt', createdAt)
      if (reviewStatus) {
        const missingEvidence = [
          reviewNote ? null : 'reviewNote',
          createdAt ? null : 'createdAt',
        ].filter((value): value is string => value !== null)
        const timestampValid = createdAt ? isValidReviewTimestamp(createdAt) : false
        properties.reviewEvidenceComplete =
          missingEvidence.length === 0 && timestampValid ? 'true' : 'false'
        if (missingEvidence.length > 0) {
          properties.reviewEvidenceMissing = missingEvidence.join(',')
        }
        if (createdAt) {
          properties.reviewEvidenceTimestampValid = timestampValid ? 'true' : 'false'
          if (!timestampValid) {
            properties.reviewEvidenceInvalid = 'createdAt'
          }
        }
      }

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties,
      })
    })
  }

  const collection = {
    type: 'FeatureCollection' as const,
    features,
  }

  if (errors.length === 0 && resolvedOutPath) {
    await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true })
    await fs.writeFile(resolvedOutPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf-8')
  }

  return {
    inputPath: resolvedInputPath,
    outPath: resolvedOutPath,
    totalRows: table.rows.length,
    featureCount: features.length,
    skippedRows,
    collection,
    errors,
    warnings,
    pass: errors.length === 0,
  }
}
