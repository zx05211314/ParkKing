import type { Delta } from './diffPackMetrics'
import type { DiffIssue } from './diffPackTypes'
import { WARN_DISTRICT_DIFF_THRESHOLDS } from './diffPackDistrictIssueThresholds'

export const buildSegmentDeltaIssues = (params: {
  districtId: string
  segmentsCount: Delta<number>
}) => {
  const issues: DiffIssue[] = []
  const { districtId, segmentsCount } = params
  const segmentsPrev = segmentsCount.prev
  const segmentsNext = segmentsCount.next
  const segmentsDeltaPct = segmentsCount.deltaPct

  if (segmentsPrev !== null && segmentsNext !== null && segmentsPrev > 0 && segmentsNext === 0) {
    issues.push({
      severity: 'FAIL',
      code: 'DIFF_SEGMENTS_ZERO',
      message: `segmentsCount dropped to 0 for ${districtId}`,
      metric: { prev: segmentsPrev, next: segmentsNext },
      threshold: { min: 1 },
    })
  }

  if (
    segmentsDeltaPct !== null &&
    Math.abs(segmentsDeltaPct) > WARN_DISTRICT_DIFF_THRESHOLDS.segmentsDeltaPct
  ) {
    issues.push({
      severity: 'WARN',
      code: 'DIFF_SEGMENTS_DELTA_PCT',
      message: `segmentsCount changed more than ${WARN_DISTRICT_DIFF_THRESHOLDS.segmentsDeltaPct * 100}% for ${districtId}`,
      metric: {
        prev: segmentsPrev,
        next: segmentsNext,
        deltaPct: segmentsDeltaPct,
      },
      threshold: { maxPct: WARN_DISTRICT_DIFF_THRESHOLDS.segmentsDeltaPct },
    })
  }

  return issues
}
