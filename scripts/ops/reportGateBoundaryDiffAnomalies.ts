import type { DistrictDiff } from './diffPackTypes'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'
import { issueSeverityOrder } from './reportGateAnomalyIssues'

export const buildBoundaryDiffAnomalies = (
  districtDiff: DistrictDiff | null,
): GateAnomalyReport['bboxCenterAnomalies'] =>
  (districtDiff?.issues ?? [])
    .filter((issue) => /BBOX|CENTER/i.test(issue.code))
    .map((issue) => ({
      severity: issue.severity === 'FAIL' ? 'FAIL' : 'WARN',
      code: issue.code,
      message: issue.message,
      metric: issue.metric,
    }))

export const sortBoundaryAnomalies = (
  anomalies: GateAnomalyReport['bboxCenterAnomalies'],
) =>
  [...anomalies].sort((a, b) => {
    const severityDelta = issueSeverityOrder(a.severity) - issueSeverityOrder(b.severity)
    if (severityDelta !== 0) {
      return severityDelta
    }
    return a.code.localeCompare(b.code)
  })
