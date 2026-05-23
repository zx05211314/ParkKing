import type { DiffIssue, DiffSeverity } from './diffPackTypes'
import type { BBoxDelta, Delta } from './diffPackMetrics'
import {
  buildBoundaryAreaIssues,
  buildOverridesRatioIssue,
  buildRateDropIssues,
  buildSegmentDeltaIssues,
  buildSignOverrideMismatchIssues,
} from './diffPackDistrictIssueBuilders'

export const sortDistrictDiffIssues = (issues: DiffIssue[]) => {
  const severityOrder: Record<DiffIssue['severity'], number> = {
    FAIL: 0,
    WARN: 1,
  }
  issues.sort((a, b) => {
    const severity = severityOrder[a.severity] - severityOrder[b.severity]
    if (severity !== 0) {
      return severity
    }
    return a.code.localeCompare(b.code)
  })
  return issues
}

export const buildDistrictDiffIssues = (params: {
  districtId: string
  segmentsCount: Delta<number>
  overridesAppliedCount: Delta<number>
  signOverrideUnmatchedNamedCount: Delta<number>
  curbMarkingKnownRate: Delta<number>
  restrictionTriggeredRate: Delta<number>
  boundaryBBox: BBoxDelta
}) => {
  const issues: DiffIssue[] = [
    ...buildSegmentDeltaIssues(params),
    ...buildRateDropIssues(params),
    ...buildOverridesRatioIssue(params),
    ...buildSignOverrideMismatchIssues(params),
    ...buildBoundaryAreaIssues(params),
  ]
  return sortDistrictDiffIssues(issues)
}

export const resolveDistrictDiffSeverity = (issues: DiffIssue[]): DiffSeverity =>
  issues.some((issue) => issue.severity === 'FAIL')
    ? 'FAIL'
    : issues.length > 0
      ? 'WARN'
      : 'OK'
