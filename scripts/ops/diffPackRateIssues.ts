import type { Delta } from './diffPackMetrics'
import type { DiffIssue } from './diffPackTypes'
import { WARN_DISTRICT_DIFF_THRESHOLDS } from './diffPackDistrictIssueThresholds'

export const buildRateDropIssues = (params: {
  districtId: string
  curbMarkingKnownRate: Delta<number>
  restrictionTriggeredRate: Delta<number>
}) => {
  const { districtId, curbMarkingKnownRate, restrictionTriggeredRate } = params
  const issues: DiffIssue[] = []

  if (curbMarkingKnownRate.prev !== null && curbMarkingKnownRate.next !== null) {
    const drop = curbMarkingKnownRate.prev - curbMarkingKnownRate.next
    if (drop > WARN_DISTRICT_DIFF_THRESHOLDS.curbMarkingDrop) {
      issues.push({
        severity: 'WARN',
        code: 'DIFF_CURB_MARKING_DROP',
        message: `curbMarkingKnownRate dropped by more than ${WARN_DISTRICT_DIFF_THRESHOLDS.curbMarkingDrop} for ${districtId}`,
        metric: {
          prev: curbMarkingKnownRate.prev,
          next: curbMarkingKnownRate.next,
          drop,
        },
        threshold: { maxDrop: WARN_DISTRICT_DIFF_THRESHOLDS.curbMarkingDrop },
      })
    }
  }

  if (restrictionTriggeredRate.prev !== null && restrictionTriggeredRate.next !== null) {
    const drop = restrictionTriggeredRate.prev - restrictionTriggeredRate.next
    if (drop > WARN_DISTRICT_DIFF_THRESHOLDS.restrictionTriggeredDrop) {
      issues.push({
        severity: 'WARN',
        code: 'DIFF_RESTRICTION_DROP',
        message: `restrictionTriggeredRate dropped by more than ${WARN_DISTRICT_DIFF_THRESHOLDS.restrictionTriggeredDrop} for ${districtId}`,
        metric: {
          prev: restrictionTriggeredRate.prev,
          next: restrictionTriggeredRate.next,
          drop,
        },
        threshold: { maxDrop: WARN_DISTRICT_DIFF_THRESHOLDS.restrictionTriggeredDrop },
      })
    }
  }

  return issues
}
