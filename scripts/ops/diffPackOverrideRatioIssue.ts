import type { Delta } from './diffPackMetrics'
import type { DiffIssue } from './diffPackTypes'
import { WARN_DISTRICT_DIFF_THRESHOLDS } from './diffPackDistrictIssueThresholds'

export const buildOverridesRatioIssue = (params: {
  districtId: string
  segmentsCount: Delta<number>
  overridesAppliedCount: Delta<number>
}) => {
  const { districtId, segmentsCount, overridesAppliedCount } = params
  const segmentsNext = segmentsCount.next
  if (
    segmentsNext === null ||
    segmentsNext <= 0 ||
    overridesAppliedCount.next === null
  ) {
    return []
  }

  const ratio = overridesAppliedCount.next / segmentsNext
  if (ratio <= WARN_DISTRICT_DIFF_THRESHOLDS.overridesRatio) {
    return []
  }

  return [
    {
      severity: 'WARN',
      code: 'DIFF_OVERRIDES_RATIO_HIGH',
      message: `overridesAppliedCount ratio exceeds ${WARN_DISTRICT_DIFF_THRESHOLDS.overridesRatio} for ${districtId}`,
      metric: {
        ratio,
        overridesAppliedCount: overridesAppliedCount.next,
        segmentsCount: segmentsNext,
      },
      threshold: { maxRatio: WARN_DISTRICT_DIFF_THRESHOLDS.overridesRatio },
    } satisfies DiffIssue,
  ]
}
