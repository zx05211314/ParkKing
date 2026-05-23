import type { SignOverridePreflightResult } from './signOverridePreflightTypes'

const formatList = (values: string[]) => {
  if (values.length === 0) {
    return '- none'
  }
  return values.map((value) => `- ${value}`).join('\n')
}

const formatInvalidReports = (result: SignOverridePreflightResult) => {
  const issues = result.invalidReportIssues ?? []
  if (issues.length === 0) {
    return '- none'
  }
  return issues
    .map((issue) => {
      const identity = [
        issue.districtId ? `district ${issue.districtId}` : null,
        issue.segmentId ? `segment ${issue.segmentId}` : null,
        issue.status ? `status ${issue.status}` : null,
      ]
        .filter(Boolean)
        .join(', ')
      const suffix = identity ? ` (${identity})` : ''
      return `- report ${issue.reportNumber}${suffix}: ${issue.reasons.join('; ')}`
    })
    .join('\n')
}

export const formatSignOverridePreflight = (
  result: SignOverridePreflightResult,
): string => {
  return [
    `# Sign Override Preflight: ${result.districtName} (${result.districtId})`,
    '',
    `- Config: ${result.configPath}`,
    `- Input: ${result.inputPath}`,
    `- Input exists: ${result.inputExists ? 'yes' : 'no'}`,
    ...(result.inputWarning ? [`- Warning: ${result.inputWarning}`] : []),
    `- Known segments: ${result.knownSegments}`,
    `- Raw reports: ${result.rawReports}`,
    `- Valid reports: ${result.validReports}`,
    `- Skipped invalid reports: ${result.skippedInvalidReports}`,
    `- Skipped foreign-district reports: ${result.skippedForeignDistrictReports}`,
    `- Effective overrides: ${result.effectiveOverrides}`,
    `- Duplicate segment ids collapsed: ${result.duplicateSegmentsCollapsed}`,
    `- Matched segment ids: ${result.matchedSegmentOverrides}`,
    `- Missing segment ids: ${result.missingSegmentOverrides}`,
    '',
    '## Status Counts',
    '',
    `- LEGAL: ${result.statusCounts.LEGAL}`,
    `- ILLEGAL: ${result.statusCounts.ILLEGAL}`,
    `- UNCLEAR: ${result.statusCounts.UNCLEAR}`,
    '',
    '## Duplicate Segment Ids',
    '',
    formatList(result.duplicateSegmentIds),
    '',
    '## Invalid Reports',
    '',
    formatInvalidReports(result),
    '',
    '## Missing Segment Ids',
    '',
    formatList(result.missingSegmentIds),
  ].join('\n')
}
