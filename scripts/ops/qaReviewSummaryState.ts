import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import { normalizeSegmentId } from './exportOverrideNormalization'
import {
  type QaReviewNextRow,
  type QaReviewPacketManifestSummary,
  type QaReviewRequirements,
  type QaReviewSummary,
  type QaReviewSummaryParams,
  VALID_QA_REVIEW_STATUSES,
} from './qaReviewSummaryTypes'
import { REVIEW_TIMESTAMP_MESSAGE, isValidReviewTimestamp } from './reviewTimestamp'

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1
}

const getCsvValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ''
}

const hasCsvKey = (row: Record<string, unknown>, keys: string[]) => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))
  return Object.keys(row).some((key) => normalizedKeys.has(key.toLowerCase()))
}

const normalizeStatus = (value: string) => value.trim().toUpperCase()
const normalizeBucket = (value: string) => value.trim() || 'unbucketed'
const normalizeReviewSource = (value: string, fallback: string) =>
  value.trim().length > 0 ? value.trim() : fallback

const nullableCsvValue = (row: Record<string, unknown>, keys: string[]) =>
  getCsvValue(row, keys) || null

const getReviewStatus = (row: Record<string, unknown>) => {
  const reviewStatusKeys = ['reviewStatus', 'status', 'overrideStatus']
  const explicitStatus = getCsvValue(row, reviewStatusKeys)
  if (explicitStatus || hasCsvKey(row, reviewStatusKeys)) {
    return explicitStatus
  }
  return getCsvValue(row, ['signOverrideStatus'])
}

const isValidStatus = (value: string) =>
  VALID_QA_REVIEW_STATUSES.includes(value as never)

interface ReviewedSegmentState {
  count: number
  statuses: Set<string>
}

const addReviewedSegment = (
  segments: Map<string, ReviewedSegmentState>,
  districtId: string,
  segmentId: string,
  status: string,
) => {
  if (!districtId || !segmentId || !isValidStatus(status)) {
    return
  }
  const key = `${districtId}::${normalizeSegmentId(segmentId)}`
  const existing = segments.get(key) ?? { count: 0, statuses: new Set<string>() }
  existing.count += 1
  existing.statuses.add(status)
  segments.set(key, existing)
}

const summarizeReviewedSegments = (segments: Map<string, ReviewedSegmentState>) => {
  let duplicateReviewedSegments = 0
  let duplicateReviewedRows = 0
  let conflictingReviewedSegments = 0

  segments.forEach((segment) => {
    if (segment.count <= 1) {
      return
    }
    duplicateReviewedSegments += 1
    duplicateReviewedRows += segment.count - 1
    if (segment.statuses.size > 1) {
      conflictingReviewedSegments += 1
    }
  })

  return {
    duplicateReviewedSegments,
    duplicateReviewedRows,
    conflictingReviewedSegments,
  }
}

const buildReviewRequirements = ({
  validReviewedRows,
  minReviewed,
  statusCounts,
  reviewedBucketCounts,
  requireStatuses,
  requireBuckets,
  minReviewedBuckets,
}: {
  validReviewedRows: number
  minReviewed: number
  statusCounts: Record<string, number>
  reviewedBucketCounts: Record<string, number>
  requireStatuses: string[]
  requireBuckets: string[]
  minReviewedBuckets: Record<string, number>
}): QaReviewRequirements => {
  const missingStatuses = requireStatuses
    .map((status) => normalizeStatus(status))
    .filter((status, index, values) => values.indexOf(status) === index)
    .filter((status) => (statusCounts[status] ?? 0) === 0)
  const missingBuckets = requireBuckets
    .map((bucket) => normalizeBucket(bucket))
    .filter((bucket, index, values) => values.indexOf(bucket) === index)
    .filter((bucket) => (reviewedBucketCounts[bucket] ?? 0) === 0)
  const bucketMinimumsRemaining: Record<string, number> = {}
  Object.entries(minReviewedBuckets).forEach(([bucket, minimum]) => {
    const normalized = normalizeBucket(bucket)
    const actual = reviewedBucketCounts[normalized] ?? 0
    if (actual < minimum) {
      bucketMinimumsRemaining[normalized] = minimum - actual
    }
  })
  const missingOnlyBucketMinimum = missingBuckets
    .filter((bucket) => bucketMinimumsRemaining[bucket] === undefined)
    .length
  const bucketMinimumReviewsRemaining =
    Object.values(bucketMinimumsRemaining).reduce((sum, value) => sum + value, 0) +
    missingOnlyBucketMinimum
  const minReviewedRemaining = Math.max(0, minReviewed - validReviewedRows)

  return {
    minReviewedRemaining,
    estimatedMinimumNewReviews: Math.max(
      minReviewedRemaining,
      missingStatuses.length,
      bucketMinimumReviewsRemaining,
    ),
    missingStatuses,
    missingBuckets,
    bucketMinimumsRemaining,
  }
}

const toNextReviewRow = (
  row: Record<string, unknown>,
  index: number,
  reviewBucket: string,
): QaReviewNextRow => ({
  rowNumber: index + 2,
  districtId: getCsvValue(row, ['districtId', 'district_id', 'district']),
  segmentId: getCsvValue(row, ['segmentId', 'segment_id', 'segment']),
  reviewBucket,
  lat: nullableCsvValue(row, ['lat', 'latitude']),
  lon: nullableCsvValue(row, ['lon', 'lng', 'longitude']),
  score: nullableCsvValue(row, ['score']),
  tier: nullableCsvValue(row, ['tier']),
  allowedNow: nullableCsvValue(row, ['allowedNow', 'action']),
  curbMarking: nullableCsvValue(row, ['curbMarking', 'curb_marking']),
  sourceType: nullableCsvValue(row, ['sourceType', 'source_type']),
  sourceReliability: nullableCsvValue(row, [
    'sourceReliability',
    'source_reliability',
  ]),
  dataFreshnessDays: nullableCsvValue(row, [
    'dataFreshnessDays',
    'freshnessDays',
    'sourceFreshnessDays',
  ]),
  finalConfidence: nullableCsvValue(row, ['finalConfidence', 'final_confidence']),
  coverageConfidence: nullableCsvValue(row, [
    'coverageConfidence',
    'coverage_confidence',
  ]),
  overrideConfidence: nullableCsvValue(row, [
    'overrideConfidence',
    'override_confidence',
  ]),
  parkingSpaceCount: nullableCsvValue(row, ['parkingSpaceCount', 'parking_spaces']),
  topReasons: nullableCsvValue(row, [
    'topReasons[]',
    'topReasons',
    'reasonCodes',
    'reasons',
  ]),
  flags: nullableCsvValue(row, ['flags', 'reviewFlags']),
  riskTags: nullableCsvValue(row, ['riskTags', 'risk_tags']),
  signOverrideStatus: nullableCsvValue(row, [
    'signOverrideStatus',
    'sign_override_status',
  ]),
  signOverrideSource: nullableCsvValue(row, [
    'signOverrideSource',
    'sign_override_source',
  ]),
  signOverrideVerifiedAt: nullableCsvValue(row, [
    'signOverrideVerifiedAt',
    'sign_override_verified_at',
  ]),
  signOverrideNote: nullableCsvValue(row, [
    'signOverrideNote',
    'sign_override_note',
  ]),
  mapsUrl: nullableCsvValue(row, ['mapsUrl', 'mapUrl']),
  streetViewUrl: nullableCsvValue(row, ['streetViewUrl', 'street_view_url']),
})

const selectNextReviewRows = (
  candidates: QaReviewNextRow[],
  requirements: QaReviewRequirements,
  limit: number,
) => {
  if (
    limit <= 0 ||
    candidates.length === 0 ||
    requirements.estimatedMinimumNewReviews <= 0
  ) {
    return []
  }
  const selected: QaReviewNextRow[] = []
  const selectedRows = new Set<number>()
  const selectedSegments = new Set<string>()
  const priorityBuckets = [
    ...requirements.missingBuckets,
    ...Object.keys(requirements.bucketMinimumsRemaining),
  ].filter((bucket, index, values) => values.indexOf(bucket) === index)

  const addCandidate = (candidate: QaReviewNextRow) => {
    const segmentKey = candidate.segmentId
      ? `${candidate.districtId}::${normalizeSegmentId(candidate.segmentId)}`
      : null
    if (
      selected.length >= limit ||
      selectedRows.has(candidate.rowNumber) ||
      (segmentKey !== null && selectedSegments.has(segmentKey))
    ) {
      return
    }
    selected.push(candidate)
    selectedRows.add(candidate.rowNumber)
    if (segmentKey !== null) {
      selectedSegments.add(segmentKey)
    }
  }

  priorityBuckets.forEach((bucket) => {
    const needed =
      requirements.bucketMinimumsRemaining[bucket] ??
      (requirements.missingBuckets.includes(bucket) ? 1 : 0)
    let addedForBucket = 0
    candidates.forEach((candidate) => {
      if (
        selected.length >= limit ||
        addedForBucket >= needed ||
        candidate.reviewBucket !== bucket
      ) {
        return
      }
      const before = selected.length
      addCandidate(candidate)
      if (selected.length > before) {
        addedForBucket += 1
      }
    })
  })

  candidates.forEach(addCandidate)
  return selected
}

const isMissingFileError = (error: unknown) =>
  error instanceof Error && (error as { code?: unknown }).code === 'ENOENT'

const adjacentManifestPath = (inputPath: string) => {
  const ext = path.extname(inputPath)
  const basePath = ext ? inputPath.slice(0, -ext.length) : inputPath
  return `${basePath}.manifest.json`
}

const getRecordValue = (record: Record<string, unknown>, key: string) =>
  record[key]

const getString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

const getNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const parseManifestSummary = (
  manifestPath: string,
  payload: unknown,
): QaReviewPacketManifestSummary => {
  const record = toRecord(payload)
  const dataset = toRecord(getRecordValue(record, 'dataset'))
  const params = toRecord(getRecordValue(record, 'params'))
  const rows = toRecord(getRecordValue(record, 'rows'))

  return {
    path: manifestPath,
    districtId: getString(getRecordValue(record, 'districtId')),
    csvPath: getString(getRecordValue(record, 'csvPath')),
    datasetBaseDir: getString(getRecordValue(dataset, 'baseDir')),
    datasetHash: getString(getRecordValue(dataset, 'datasetHash')),
    datasetSourceHash: getString(getRecordValue(dataset, 'datasetSourceHash')),
    generatorHash: getString(getRecordValue(dataset, 'generatorHash')),
    configHash: getString(getRecordValue(dataset, 'configHash')),
    generatedAt: getString(getRecordValue(dataset, 'generatedAt')),
    publishedAt: getString(getRecordValue(dataset, 'publishedAt')),
    strategy: getString(getRecordValue(params, 'strategy')),
    hhmm: getString(getRecordValue(params, 'hhmm')),
    topN: getNumber(getRecordValue(params, 'topN')),
    rowsTotal: getNumber(getRecordValue(rows, 'total')),
  }
}

const loadReviewManifest = async (
  inputPath: string,
  manifestPath?: string | null,
  strictManifest = false,
) => {
  const explicit = Boolean(manifestPath)
  const resolvedManifestPath = path.resolve(manifestPath ?? adjacentManifestPath(inputPath))

  try {
    const raw = await fs.readFile(resolvedManifestPath, 'utf-8')
    const manifest = parseManifestSummary(resolvedManifestPath, JSON.parse(raw) as unknown)
    const warnings: string[] = []
    const errors: string[] = []
    if (manifest.csvPath && path.resolve(manifest.csvPath) !== inputPath) {
      const message = `Review manifest csvPath ${manifest.csvPath} does not match input ${inputPath}.`
      if (strictManifest) {
        errors.push(message)
      } else {
        warnings.push(message)
      }
    }
    return { manifest, warnings, errors }
  } catch (error) {
    if (isMissingFileError(error) && !explicit) {
      return { manifest: null, warnings: [], errors: [] }
    }
    const reason = error instanceof Error ? error.message : String(error)
    const message = `Review manifest not loaded from ${resolvedManifestPath}: ${reason}`
    return strictManifest
      ? { manifest: null, warnings: [], errors: [message] }
      : { manifest: null, warnings: [message], errors: [] }
  }
}

export const buildQaReviewSummary = async ({
  inputPath,
  manifestPath,
  strictManifest = false,
  strictReviewedRows = false,
  strictReviewedSegments = false,
  nextReviewRowsLimit = 10,
  minReviewed = 1,
  requireStatuses = [],
  requireBuckets = [],
  minReviewedBuckets = {},
}: QaReviewSummaryParams): Promise<QaReviewSummary> => {
  const resolvedInputPath = path.resolve(inputPath)
  const manifestState = await loadReviewManifest(
    resolvedInputPath,
    manifestPath,
    strictManifest,
  )
  const raw = await fs.readFile(resolvedInputPath, 'utf-8')
  const rows = parseCsv(raw, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[]

  const statusCounts: Record<string, number> = {}
  const reviewSourceCounts: Record<string, number> = {}
  const bucketCounts: Record<string, number> = {}
  const reviewedBucketCounts: Record<string, number> = {}
  const districtCounts: Record<string, number> = {}
  const reviewedSegments = new Map<string, ReviewedSegmentState>()
  const pendingCandidates: QaReviewNextRow[] = []
  let reviewedRows = 0
  let validReviewedRows = 0
  let invalidStatusRows = 0
  let missingIdentityRows = 0
  let missingEvidenceRows = 0
  let invalidTimestampRows = 0

  rows.forEach((row, index) => {
    const districtId = getCsvValue(row, ['districtId', 'district_id', 'district'])
    const segmentId = getCsvValue(row, ['segmentId', 'segment_id', 'segment'])
    const status = normalizeStatus(getReviewStatus(row))
    const reviewSource = getCsvValue(row, ['reviewSource', 'review_source'])
    const reviewNote = getCsvValue(row, ['reviewNote', 'note', 'overrideNote'])
    const createdAt = getCsvValue(row, ['createdAt', 'reviewedAt', 'verifiedAt'])
    const bucket = normalizeBucket(
      getCsvValue(row, ['reviewBucket', 'bucket', 'sampleBucket']),
    )

    increment(bucketCounts, bucket)
    if (districtId) {
      increment(districtCounts, districtId)
    }
    if (!status) {
      increment(reviewSourceCounts, normalizeReviewSource(reviewSource, 'pending'))
      pendingCandidates.push(toNextReviewRow(row, index, bucket))
      return
    }

    reviewedRows += 1
    increment(statusCounts, status)
    increment(reviewSourceCounts, normalizeReviewSource(reviewSource, 'manual'))
    increment(reviewedBucketCounts, bucket)

    if (!districtId || !segmentId) {
      missingIdentityRows += 1
    }
    if (!reviewNote || !createdAt) {
      missingEvidenceRows += 1
    } else if (!isValidReviewTimestamp(createdAt)) {
      invalidTimestampRows += 1
    }
    if (isValidStatus(status)) {
      if (districtId && segmentId) {
        validReviewedRows += 1
        addReviewedSegment(reviewedSegments, districtId, segmentId, status)
      }
    } else {
      invalidStatusRows += 1
    }
  })

  const segmentSummary = summarizeReviewedSegments(reviewedSegments)
  const reviewRequirements = buildReviewRequirements({
    validReviewedRows,
    minReviewed,
    statusCounts,
    reviewedBucketCounts,
    requireStatuses,
    requireBuckets,
    minReviewedBuckets,
  })
  const nextReviewRows = selectNextReviewRows(
    pendingCandidates,
    reviewRequirements,
    nextReviewRowsLimit,
  )

  const errors: string[] = [...manifestState.errors]
  const warnings: string[] = [...manifestState.warnings]
  if (rows.length === 0) {
    errors.push('CSV has no data rows.')
  }
  const manifestRowsTotal = manifestState.manifest?.rowsTotal
  if (
    manifestRowsTotal !== null &&
    manifestRowsTotal !== undefined &&
    manifestRowsTotal !== rows.length
  ) {
    const message = `Review manifest row total ${manifestRowsTotal} does not match CSV row total ${rows.length}.`
    if (strictManifest) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }
  if (validReviewedRows < minReviewed) {
    errors.push(
      `Valid reviewed rows ${validReviewedRows} is below required minimum ${minReviewed}.`,
    )
  }

  requireStatuses.forEach((status) => {
    const normalized = normalizeStatus(status)
    if ((statusCounts[normalized] ?? 0) === 0) {
      errors.push(`Missing required review status ${normalized}.`)
    }
  })

  requireBuckets.forEach((bucket) => {
    const normalized = normalizeBucket(bucket)
    if ((reviewedBucketCounts[normalized] ?? 0) === 0) {
      errors.push(`Missing reviewed row for required bucket ${normalized}.`)
    }
  })

  Object.entries(minReviewedBuckets).forEach(([bucket, minimum]) => {
    const normalized = normalizeBucket(bucket)
    const actual = reviewedBucketCounts[normalized] ?? 0
    if (actual < minimum) {
      errors.push(
        `Reviewed rows for bucket ${normalized} ${actual} is below required minimum ${minimum}.`,
      )
    }
  })

  if (invalidStatusRows > 0) {
    const message = `${invalidStatusRows} reviewed row(s) use a status outside LEGAL, ILLEGAL, UNCLEAR.`
    if (strictReviewedRows) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }
  if (missingIdentityRows > 0) {
    const message = `${missingIdentityRows} reviewed row(s) are missing districtId or segmentId.`
    if (strictReviewedRows) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }
  if (missingEvidenceRows > 0) {
    const message = `${missingEvidenceRows} reviewed row(s) are missing reviewNote or createdAt.`
    if (strictReviewedRows) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }
  if (invalidTimestampRows > 0) {
    const message = `${invalidTimestampRows} reviewed row(s) have invalid createdAt timestamps; ${REVIEW_TIMESTAMP_MESSAGE}.`
    if (strictReviewedRows) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }
  if (segmentSummary.duplicateReviewedSegments > 0) {
    const message = `${segmentSummary.duplicateReviewedSegments} segment(s) have multiple reviewed rows; export would collapse ${segmentSummary.duplicateReviewedRows} reviewed row(s) to the latest verdict.`
    if (strictReviewedSegments) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }
  if (segmentSummary.conflictingReviewedSegments > 0) {
    const message = `${segmentSummary.conflictingReviewedSegments} segment(s) have conflicting reviewed statuses for the same districtId+segmentId.`
    if (strictReviewedSegments) {
      errors.push(message)
    } else {
      warnings.push(message)
    }
  }

  return {
    inputPath: resolvedInputPath,
    manifest: manifestState.manifest,
    totalRows: rows.length,
    reviewedRows,
    validReviewedRows,
    pendingRows: rows.length - reviewedRows,
    invalidStatusRows,
    missingIdentityRows,
    missingEvidenceRows,
    invalidTimestampRows,
    duplicateReviewedSegments: segmentSummary.duplicateReviewedSegments,
    duplicateReviewedRows: segmentSummary.duplicateReviewedRows,
    conflictingReviewedSegments: segmentSummary.conflictingReviewedSegments,
    statusCounts,
    reviewSourceCounts,
    bucketCounts,
    reviewedBucketCounts,
    districtCounts,
    reviewRequirements,
    nextReviewRows,
    errors,
    warnings,
    pass: errors.length === 0,
  }
}
