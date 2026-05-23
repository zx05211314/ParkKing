import {
  DIFF_SCHEMA_VERSIONS,
  parseDiffSchemaVersion,
} from './publishGatePolicy'
import type { DiffIssue, PackDiffReport } from './diffPackTypes'
import type { GateWarning } from './publishGateTypes'

export const mapPublishGateDiffIssueToWarning = (
  issue: DiffIssue,
  strictDiff?: boolean,
): GateWarning => ({
  severity: strictDiff && issue.severity === 'WARN' ? 'FAIL' : issue.severity,
  code: issue.code,
  message: issue.message,
  metric: issue.metric,
  threshold: issue.threshold,
})

export const buildPublishGateDiffReportWarnings = (params: {
  districtId: string
  diffReport: PackDiffReport
  strictDiff?: boolean
}) => {
  const schemaVersion = parseDiffSchemaVersion(params.diffReport.schemaVersion)
  if (!schemaVersion || !DIFF_SCHEMA_VERSIONS.has(schemaVersion)) {
    return [
      {
        severity: 'WARN',
        code: 'DIFF_SCHEMA_UNKNOWN',
        message: `diff_report schemaVersion unknown for ${params.districtId}`,
        metric: { schemaVersion: params.diffReport.schemaVersion },
      } satisfies GateWarning,
    ]
  }

  return (
    params.diffReport.districts
      ?.find((entry) => entry.districtId === params.districtId)
      ?.issues?.map((issue) =>
        mapPublishGateDiffIssueToWarning(issue, params.strictDiff),
      ) ?? []
  )
}
