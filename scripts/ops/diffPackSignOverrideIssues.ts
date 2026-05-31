import type { Delta } from './diffPackMetrics'
import type { DiffIssue } from './diffPackTypes'
import { WARN_DISTRICT_DIFF_THRESHOLDS } from './diffPackDistrictIssueThresholds'

export const buildSignOverrideMismatchIssues = (params: {
  districtId: string
  signOverrideUnmatchedNamedCount: Delta<number>
}) => {
  const { districtId, signOverrideUnmatchedNamedCount } = params
  if (
    signOverrideUnmatchedNamedCount.prev === null ||
    signOverrideUnmatchedNamedCount.next === null
  ) {
    return [] satisfies DiffIssue[]
  }

  const increase =
    signOverrideUnmatchedNamedCount.next - signOverrideUnmatchedNamedCount.prev
  if (increase <= WARN_DISTRICT_DIFF_THRESHOLDS.signOverrideUnmatchedNamedIncrease) {
    return [] satisfies DiffIssue[]
  }

  return [
    {
      severity: 'WARN',
      code: 'DIFF_SIGN_OVERRIDE_UNMATCHED_INCREASE',
      message: `signOverrideUnmatchedNamedCount increased for ${districtId}`,
      metric: {
        prev: signOverrideUnmatchedNamedCount.prev,
        next: signOverrideUnmatchedNamedCount.next,
        increase,
      },
      threshold: {
        maxIncrease: WARN_DISTRICT_DIFF_THRESHOLDS.signOverrideUnmatchedNamedIncrease,
      },
    },
  ] satisfies DiffIssue[]
}
