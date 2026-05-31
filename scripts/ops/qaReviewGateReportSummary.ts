import * as path from 'node:path'
import { normalizeSegmentId } from './exportOverrideNormalization'
import { parseReportInputFile } from './exportOverrideStore'
import {
  type QaReviewRequirements,
  type QaReviewSummary,
  type QaReviewSummaryParams,
  VALID_QA_REVIEW_STATUSES,
} from './qaReviewSummaryTypes'
import { REVIEW_TIMESTAMP_MESSAGE, isValidReviewTimestamp } from './reviewTimestamp'

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1
}

const normalizeStatus = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : ''

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

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
  requireStatuses,
  requireBuckets,
  minReviewedBuckets,
}: {
  validReviewedRows: number
  minReviewed: number
  statusCounts: Record<string, number>
  requireStatuses: string[]
  requireBuckets: string[]
  minReviewedBuckets: Record<string, number>
}): QaReviewRequirements => {
  const minReviewedRemaining = Math.max(0, minReviewed - validReviewedRows)
  const missingStatuses = requireStatuses
    .map((status) => normalizeStatus(status))
    .filter((status, index, values) => values.indexOf(status) === index)
    .filter((status) => (statusCounts[status] ?? 0) === 0)
  const missingBuckets = requireBuckets.filter(
    (bucket, index, values) => values.indexOf(bucket) === index,
  )
  const bucketMinimumReviewsRemaining =
    Object.values(minReviewedBuckets).reduce((sum, value) => sum + value, 0) +
    missingBuckets.filter((bucket) => minReviewedBuckets[bucket] === undefined).length
  return {
    minReviewedRemaining,
    estimatedMinimumNewReviews: Math.max(
      minReviewedRemaining,
      missingStatuses.length,
      bucketMinimumReviewsRemaining,
    ),
    missingStatuses,
    missingBuckets,
    bucketMinimumsRemaining: { ...minReviewedBuckets },
  }
}

export const buildQaReviewReportSummary = async ({
  inputPath,
  strictReviewedRows = false,
  strictReviewedSegments = false,
  minReviewed = 1,
  requireStatuses = [],
  requireBuckets = [],
  minReviewedBuckets = {},
}: QaReviewSummaryParams): Promise<QaReviewSummary> => {
  const resolvedInputPath = path.resolve(inputPath)
  const reports = await parseReportInputFile(resolvedInputPath)
  const statusCounts: Record<string, number> = {}
  const districtCounts: Record<string, number> = {}
  const reviewedSegments = new Map<string, ReviewedSegmentState>()
  let reviewedRows = 0
  let validReviewedRows = 0
  let invalidStatusRows = 0
  let missingIdentityRows = 0
  let missingEvidenceRows = 0
  let invalidTimestampRows = 0

  reports.forEach((report) => {
    const districtId = normalizeText(report.districtId)
    const segmentId = normalizeText(report.segmentId)
    const status = normalizeStatus(report.status)
    const note = normalizeText(report.note)
    const createdAt = normalizeText(report.createdAt)

    if (districtId) {
      increment(districtCounts, districtId)
    }
    if (!status) {
      return
    }

    reviewedRows += 1
    increment(statusCounts, status)

    if (!districtId || !segmentId) {
      missingIdentityRows += 1
    }
    if (!note || !createdAt) {
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
    requireStatuses,
    requireBuckets,
    minReviewedBuckets,
  })

  const errors: string[] = []
  const warnings: string[] = []
  if (reports.length === 0) {
    errors.push('Report input has no data rows.')
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
    errors.push(
      `Report input has no reviewBucket column; cannot verify required bucket ${bucket}. Use QA review CSV input for bucket coverage.`,
    )
  })

  Object.entries(minReviewedBuckets).forEach(([bucket, minimum]) => {
    errors.push(
      `Report input has no reviewBucket column; cannot verify minimum ${minimum} reviewed row(s) for bucket ${bucket}. Use QA review CSV input for bucket coverage.`,
    )
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
    totalRows: reports.length,
    reviewedRows,
    validReviewedRows,
    pendingRows: reports.length - reviewedRows,
    invalidStatusRows,
    missingIdentityRows,
    missingEvidenceRows,
    invalidTimestampRows,
    duplicateReviewedSegments: segmentSummary.duplicateReviewedSegments,
    duplicateReviewedRows: segmentSummary.duplicateReviewedRows,
    conflictingReviewedSegments: segmentSummary.conflictingReviewedSegments,
    statusCounts,
    reviewSourceCounts: {},
    bucketCounts: {},
    reviewedBucketCounts: {},
    districtCounts,
    reviewRequirements,
    nextReviewRows: [],
    errors,
    warnings,
    pass: errors.length === 0,
  }
}
