import type { QaReviewSummary } from './qaReviewSummaryTypes'
import {
  buildQaReviewPlanAssignments,
  buildQaReviewPlanLines,
} from './qaReviewPlan'

const formatCounts = (counts: Record<string, number>) => {
  const entries = Object.entries(counts).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  if (entries.length === 0) {
    return 'none'
  }
  return entries.map(([key, value]) => `${key} ${value}`).join(', ')
}

const formatManifest = (summary: QaReviewSummary) => {
  if (!summary.manifest) {
    return []
  }
  const manifest = summary.manifest
  return [
    `Manifest: ${manifest.path}`,
    `Packet: district ${manifest.districtId ?? 'unknown'}, strategy ${manifest.strategy ?? 'unknown'}, hhmm ${manifest.hhmm ?? 'unknown'}, rows ${manifest.rowsTotal ?? 'unknown'}`,
    `Dataset hash: ${manifest.datasetHash ?? 'unknown'}`,
    `Config hash: ${manifest.configHash ?? 'unknown'}`,
  ]
}

const formatRequirements = (summary: QaReviewSummary) => {
  const { reviewRequirements } = summary
  const bucketMinimums = Object.entries(reviewRequirements.bucketMinimumsRemaining)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, remaining]) => `${bucket} ${remaining}`)
  return [
    `Estimated minimum new reviews: ${reviewRequirements.estimatedMinimumNewReviews}`,
    `Remaining valid reviews: ${reviewRequirements.minReviewedRemaining}`,
    `Missing statuses: ${reviewRequirements.missingStatuses.join(', ') || 'none'}`,
    `Missing buckets: ${reviewRequirements.missingBuckets.join(', ') || 'none'}`,
    `Bucket minimums remaining: ${bucketMinimums.join(', ') || 'none'}`,
  ]
}

const formatNextReviewRows = (summary: QaReviewSummary) => {
  if (summary.nextReviewRows.length === 0) {
    return ['- none']
  }
  return summary.nextReviewRows.map((row) => {
    const location = row.lat && row.lon ? `${row.lat},${row.lon}` : 'unknown location'
    const context = [
      row.tier ? `tier ${row.tier}` : null,
      row.allowedNow ? `action ${row.allowedNow}` : null,
      row.score ? `score ${row.score}` : null,
      row.curbMarking ? `curb ${row.curbMarking}` : null,
      row.sourceType ? `source ${row.sourceType}` : null,
      row.finalConfidence ? `confidence ${row.finalConfidence}` : null,
      row.parkingSpaceCount ? `spaces ${row.parkingSpaceCount}` : null,
      row.topReasons ? `reasons ${row.topReasons}` : null,
      row.flags ? `flags ${row.flags}` : null,
      row.riskTags ? `risk ${row.riskTags}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    return `- row ${row.rowNumber}: ${row.reviewBucket} ${row.segmentId || 'unknown segment'} at ${location}${context ? ` (${context})` : ''}${row.streetViewUrl ? ` | ${row.streetViewUrl}` : ''}`
  })
}

const csvEscape = (value: string | number | null) => {
  const text = value === null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const formatQaNextReviewRowsCsv = (summary: QaReviewSummary) => {
  const headers = [
    'sourceRowNumber',
    'districtId',
    'segmentId',
    'reviewBucket',
    'lat',
    'lon',
    'score',
    'tier',
    'allowedNow',
    'curbMarking',
    'sourceType',
    'sourceReliability',
    'dataFreshnessDays',
    'finalConfidence',
    'coverageConfidence',
    'overrideConfidence',
    'parkingSpaceCount',
    'topReasons',
    'flags',
    'riskTags',
    'signOverrideStatus',
    'signOverrideSource',
    'signOverrideVerifiedAt',
    'signOverrideNote',
    'mapsUrl',
    'streetViewUrl',
    'sourceDatasetHash',
    'sourceConfigHash',
    'sourceRowsTotal',
    'reviewPlanRank',
    'reviewPlanReason',
    'reviewStatus',
    'reviewNote',
    'createdAt',
  ]
  const sourceDatasetHash = summary.manifest?.datasetHash ?? ''
  const sourceConfigHash = summary.manifest?.configHash ?? ''
  const sourceRowsTotal = summary.manifest?.rowsTotal ?? ''
  const reviewPlanAssignments = buildQaReviewPlanAssignments(summary)
  const rows = summary.nextReviewRows.map((row) => {
    const assignment = reviewPlanAssignments.get(row.rowNumber)
    return [
      row.rowNumber,
      row.districtId,
      row.segmentId,
      row.reviewBucket,
      row.lat,
      row.lon,
      row.score,
      row.tier,
      row.allowedNow,
      row.curbMarking ?? null,
      row.sourceType ?? null,
      row.sourceReliability ?? null,
      row.dataFreshnessDays ?? null,
      row.finalConfidence ?? null,
      row.coverageConfidence ?? null,
      row.overrideConfidence ?? null,
      row.parkingSpaceCount,
      row.topReasons ?? null,
      row.flags ?? null,
      row.riskTags ?? null,
      row.signOverrideStatus ?? null,
      row.signOverrideSource ?? null,
      row.signOverrideVerifiedAt ?? null,
      row.signOverrideNote ?? null,
      row.mapsUrl,
      row.streetViewUrl,
      sourceDatasetHash,
      sourceConfigHash,
      sourceRowsTotal,
      assignment?.rank ?? '',
      assignment?.reasons.join('|') ?? '',
      '',
      '',
      '',
    ]
      .map(csvEscape)
      .join(',')
  })
  return `${[headers.join(','), ...rows].join('\n')}\n`
}

export const formatQaReviewSummary = (summary: QaReviewSummary) => {
  const lines = [
    `QA review summary: ${summary.inputPath}`,
    `Status: ${summary.pass ? 'PASS' : 'FAIL'}`,
    ...formatManifest(summary),
    `Rows: total ${summary.totalRows}, reviewed ${summary.reviewedRows}, valid ${summary.validReviewedRows}, pending ${summary.pendingRows}`,
    `Review integrity: invalid statuses ${summary.invalidStatusRows}, missing identity ${summary.missingIdentityRows}, missing evidence ${summary.missingEvidenceRows ?? 0}, invalid timestamps ${summary.invalidTimestampRows ?? 0}, duplicate segments ${summary.duplicateReviewedSegments}, conflicting segments ${summary.conflictingReviewedSegments}`,
    `Statuses: ${formatCounts(summary.statusCounts)}`,
    `Review sources: ${formatCounts(summary.reviewSourceCounts)}`,
    `Buckets: ${formatCounts(summary.bucketCounts)}`,
    `Reviewed buckets: ${formatCounts(summary.reviewedBucketCounts)}`,
    `Districts: ${formatCounts(summary.districtCounts)}`,
    'Review requirements:',
    ...formatRequirements(summary).map((line) => `- ${line}`),
    'Review plan:',
    ...buildQaReviewPlanLines(summary),
    'Next review rows:',
    ...formatNextReviewRows(summary),
  ]

  if (summary.errors.length > 0) {
    lines.push('Errors:')
    summary.errors.forEach((error) => lines.push(`- ${error}`))
  }
  if (summary.warnings.length > 0) {
    lines.push('Warnings:')
    summary.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }

  return `${lines.join('\n')}\n`
}
