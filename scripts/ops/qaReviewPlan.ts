import type { QaReviewNextRow, QaReviewSummary } from './qaReviewSummaryTypes'

export interface QaReviewPlanAssignment {
  rank: number
  reasons: string[]
}

const rowRef = (row: QaReviewNextRow) =>
  `row ${row.rowNumber} (${row.reviewBucket} ${row.segmentId || 'unknown segment'})`

const formatRowRefs = (rows: QaReviewNextRow[]) =>
  rows.length === 0 ? 'none available in next-review rows' : rows.map(rowRef).join(', ')

const pickRows = (
  rows: QaReviewNextRow[],
  selectedRows: Set<number>,
  count: number,
  bucket?: string,
) => {
  const picked: QaReviewNextRow[] = []
  rows.forEach((row) => {
    if (picked.length >= count || selectedRows.has(row.rowNumber)) {
      return
    }
    if (bucket && row.reviewBucket !== bucket) {
      return
    }
    picked.push(row)
    selectedRows.add(row.rowNumber)
  })
  return picked
}

const assignRows = (
  assignments: Map<number, QaReviewPlanAssignment>,
  rows: QaReviewNextRow[],
  reason: string,
) => {
  rows.forEach((row) => {
    const existing = assignments.get(row.rowNumber)
    if (existing) {
      existing.reasons.push(reason)
      return
    }
    assignments.set(row.rowNumber, {
      rank: assignments.size + 1,
      reasons: [reason],
    })
  })
}

const buildBucketTargets = (summary: QaReviewSummary) => {
  const bucketTargets = new Map<string, number>()
  Object.entries(summary.reviewRequirements.bucketMinimumsRemaining).forEach(
    ([bucket, count]) => {
      bucketTargets.set(bucket, Math.max(bucketTargets.get(bucket) ?? 0, count))
    },
  )
  summary.reviewRequirements.missingBuckets.forEach((bucket) => {
    bucketTargets.set(bucket, Math.max(bucketTargets.get(bucket) ?? 0, 1))
  })
  return bucketTargets
}

export const buildQaReviewPlanAssignments = (summary: QaReviewSummary) => {
  const requirements = summary.reviewRequirements
  const assignments = new Map<number, QaReviewPlanAssignment>()
  const selectedRows = new Set<number>()

  Array.from(buildBucketTargets(summary).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([bucket, count]) => {
      const rows = pickRows(summary.nextReviewRows, selectedRows, count, bucket)
      assignRows(assignments, rows, `bucket:${bucket}`)
    })

  const additionalNeeded = Math.max(0, requirements.minReviewedRemaining - selectedRows.size)
  if (additionalNeeded > 0) {
    const rows = pickRows(summary.nextReviewRows, selectedRows, additionalNeeded)
    assignRows(assignments, rows, 'additional_valid_review')
  }

  const statusCoverageRowsNeeded = Math.max(
    0,
    requirements.estimatedMinimumNewReviews - selectedRows.size,
  )
  if (statusCoverageRowsNeeded > 0) {
    const rows = pickRows(summary.nextReviewRows, selectedRows, statusCoverageRowsNeeded)
    assignRows(assignments, rows, 'status_coverage_candidate')
  }

  return assignments
}

export const buildQaReviewPlanLines = (summary: QaReviewSummary) => {
  const requirements = summary.reviewRequirements
  const hasRequirements =
    requirements.estimatedMinimumNewReviews > 0 ||
    requirements.missingStatuses.length > 0 ||
    requirements.missingBuckets.length > 0 ||
    Object.keys(requirements.bucketMinimumsRemaining).length > 0

  if (!hasRequirements) {
    return ['- No additional review rows required by configured thresholds.']
  }

  const lines = [
    `- Minimum new reviewed rows needed: ${requirements.estimatedMinimumNewReviews}`,
  ]
  if (requirements.missingStatuses.length > 0) {
    lines.push(
      `- Status coverage still needs: ${requirements.missingStatuses.join(', ')}; fill reviewStatus only after checking sign/curb evidence.`,
    )
  }

  const selectedRows = new Set<number>()

  Array.from(buildBucketTargets(summary).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([bucket, count]) => {
      const rows = pickRows(summary.nextReviewRows, selectedRows, count, bucket)
      lines.push(`- Bucket ${bucket}: review ${count}; suggested ${formatRowRefs(rows)}.`)
    })

  const additionalNeeded = Math.max(0, requirements.minReviewedRemaining - selectedRows.size)
  if (additionalNeeded > 0) {
    const rows = pickRows(summary.nextReviewRows, selectedRows, additionalNeeded)
    lines.push(
      `- Additional valid reviewed rows: review ${additionalNeeded}; suggested ${formatRowRefs(rows)}.`,
    )
  }

  const statusCoverageRowsNeeded = Math.max(
    0,
    requirements.estimatedMinimumNewReviews - selectedRows.size,
  )
  if (statusCoverageRowsNeeded > 0) {
    const rows = pickRows(summary.nextReviewRows, selectedRows, statusCoverageRowsNeeded)
    lines.push(
      `- Extra rows for status coverage if needed: review ${statusCoverageRowsNeeded}; suggested ${formatRowRefs(rows)}.`,
    )
  }

  if (summary.nextReviewRows.length === 0) {
    lines.push(
      '- No pending candidate rows are available in this packet; regenerate with a larger --topN or --next-review-limit.',
    )
  }

  return lines
}
