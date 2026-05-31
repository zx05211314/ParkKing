export interface IssueReportWorkflowArtifactArgs {
  manifestPath?: string | null
  syncStorePath: string | null
  outRoot: string
  limit: number
  packetIssueLimit: number
  publishGateSummaryPath: string | null
  indexBaseUrl?: string | null
  packetRootUrl: string | null
  csvRootUrl: string | null
}

const DEFAULT_LIMIT = 5
const DEFAULT_PACKET_ISSUE_LIMIT = 5
const DEFAULT_OUT_ROOT = '.tmp/issue-report-artifacts'

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const parsePositiveInteger = (value: string | null, fallback: number, label: string) => {
  if (value === null) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

const normalizeOptionalText = (value: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeOptionalBaseUrl = (value: string | null) =>
  normalizeOptionalText(value)?.replace(/\/+$/, '') ?? null

const resolveCompatUrlArg = (params: {
  argv: string[]
  primaryFlag: string
  legacyFlag: string
  label: string
}) => {
  const primaryValue = normalizeOptionalBaseUrl(parseArgValue(params.argv, params.primaryFlag))
  const legacyValue = normalizeOptionalBaseUrl(parseArgValue(params.argv, params.legacyFlag))
  if (primaryValue && legacyValue && primaryValue !== legacyValue) {
    throw new Error(
      `${params.label} received conflicting values for ${params.primaryFlag} and legacy alias ${params.legacyFlag}`,
    )
  }
  return primaryValue ?? legacyValue ?? null
}

export const parseIssueReportWorkflowArtifactArgs = (
  argv: string[],
): IssueReportWorkflowArtifactArgs => ({
  manifestPath: normalizeOptionalText(parseArgValue(argv, '--manifest')),
  syncStorePath: normalizeOptionalText(parseArgValue(argv, '--sync-store')),
  outRoot:
    normalizeOptionalText(parseArgValue(argv, '--out-root')) ?? DEFAULT_OUT_ROOT,
  limit: parsePositiveInteger(parseArgValue(argv, '--limit'), DEFAULT_LIMIT, 'limit'),
  packetIssueLimit: parsePositiveInteger(
    parseArgValue(argv, '--packet-issue-limit'),
    DEFAULT_PACKET_ISSUE_LIMIT,
    'packet issue limit',
  ),
  publishGateSummaryPath: normalizeOptionalText(
    parseArgValue(argv, '--publish-gate-summary'),
  ),
  indexBaseUrl: normalizeOptionalBaseUrl(
    parseArgValue(argv, '--index-base-url'),
  ),
  packetRootUrl: resolveCompatUrlArg({
    argv,
    primaryFlag: '--packet-root-url',
    legacyFlag: '--packet-artifact-url',
    label: 'packet root url',
  }),
  csvRootUrl: resolveCompatUrlArg({
    argv,
    primaryFlag: '--csv-root-url',
    legacyFlag: '--csv-artifact-url',
    label: 'csv root url',
  }),
})
