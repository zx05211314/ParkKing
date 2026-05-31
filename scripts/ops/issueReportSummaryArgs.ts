import type { IssueReportSummaryArgs } from './issueReportSummaryTypes'

const DEFAULT_LIMIT = 20
const DEFAULT_PACKET_ISSUE_LIMIT = 5

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

const parseSince = (value: string | null) => {
  if (!value || value.trim().length === 0) {
    return null
  }
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('since must be a valid date or ISO timestamp')
  }
  return new Date(parsed).toISOString()
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

const parseRootUrlFlag = (
  argv: string[],
  primaryFlag: string,
  aliasFlag: string,
) => {
  const primary = normalizeOptionalBaseUrl(parseArgValue(argv, primaryFlag))
  const alias = normalizeOptionalBaseUrl(parseArgValue(argv, aliasFlag))
  if (primary && alias && primary !== alias) {
    throw new Error(`${primaryFlag} conflicts with ${aliasFlag}`)
  }
  return primary ?? alias
}

export const parseIssueReportSummaryArgs = (
  argv: string[],
): IssueReportSummaryArgs => ({
  syncStorePath: normalizeOptionalText(parseArgValue(argv, '--sync-store')),
  publishGateSummaryPath: normalizeOptionalText(
    parseArgValue(argv, '--publish-gate-summary'),
  ),
  scope: normalizeOptionalText(parseArgValue(argv, '--scope')),
  districtId: normalizeOptionalText(parseArgValue(argv, '--district')),
  segmentId: normalizeOptionalText(parseArgValue(argv, '--segment')),
  reasonCode: normalizeOptionalText(parseArgValue(argv, '--reason')),
  since: parseSince(parseArgValue(argv, '--since')),
  limit: parsePositiveInteger(parseArgValue(argv, '--limit'), DEFAULT_LIMIT, 'limit'),
  outPath: normalizeOptionalText(parseArgValue(argv, '--out')),
  summaryBaseUrl: normalizeOptionalBaseUrl(parseArgValue(argv, '--summary-base-url')),
  rawOutPath: normalizeOptionalText(parseArgValue(argv, '--raw-out')),
  rawBaseUrl: normalizeOptionalBaseUrl(parseArgValue(argv, '--raw-base-url')),
  csvOutPath: normalizeOptionalText(parseArgValue(argv, '--csv-out')),
  csvRootUrl: parseRootUrlFlag(argv, '--csv-root-url', '--csv-base-url'),
  packetOutPath: normalizeOptionalText(parseArgValue(argv, '--packet-out')),
  packetRootUrl: parseRootUrlFlag(argv, '--packet-root-url', '--packet-base-url'),
  packetIssueLimit: parsePositiveInteger(
    parseArgValue(argv, '--packet-issue-limit'),
    DEFAULT_PACKET_ISSUE_LIMIT,
    'packet issue limit',
  ),
  json: argv.includes('--json'),
})
