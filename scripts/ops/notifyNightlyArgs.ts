import type { NotifyNightlyArgs } from './notifyNightlyTypes'

const DEFAULT_ISSUE_LIMIT = 5
const DEFAULT_PACKET_ISSUE_LIMIT = 5

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

const parseAliasedArgValue = (
  primaryValue: string | null,
  legacyValue: string | null,
  primaryFlag: string,
  legacyFlag: string,
  label: string,
) => {
  const normalizedPrimaryValue = normalizeOptionalText(primaryValue)
  const normalizedLegacyValue = normalizeOptionalText(legacyValue)
  if (
    normalizedPrimaryValue !== null &&
    normalizedLegacyValue !== null &&
    normalizedPrimaryValue !== normalizedLegacyValue
  ) {
    throw new Error(`${label} must not conflict between ${primaryFlag} and ${legacyFlag}`)
  }
  return normalizedPrimaryValue ?? normalizedLegacyValue
}

export const parseNotifyNightlyArgs = (argv: string[]): NotifyNightlyArgs => {
  const args = [...argv]
  const diffPaths: string[] = []
  let syncStorePath: string | null = null
  let issueInputPath: string | null = null
  let issueIndexPath: string | null = null
  let issueLimit: string | null = null
  let issuePacketOutPath: string | null = null
  let issueCsvOutPath: string | null = null
  let issuePacketIssueLimit: string | null = null
  let issueInputUrl: string | null = null
  let issueIndexUrl: string | null = null
  let issuePacketUrl: string | null = null
  let issueCsvUrl: string | null = null
  let publishGateSummaryPath: string | null = null
  let publishGateSummaryUrl: string | null = null
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--diff') {
      diffPaths.push(args[index + 1] ?? '')
    }
    if (args[index] === '--sync-store') {
      syncStorePath = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-index') {
      issueIndexPath = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-input') {
      issueInputPath = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-limit') {
      issueLimit = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-packet-out') {
      issuePacketOutPath = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-csv-out') {
      issueCsvOutPath = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-packet-issue-limit') {
      issuePacketIssueLimit = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-index-url') {
      issueIndexUrl = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-input-url') {
      issueInputUrl = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-packet-url') {
      issuePacketUrl = args[index + 1] ?? ''
    }
    if (args[index] === '--issue-csv-url') {
      issueCsvUrl = args[index + 1] ?? ''
    }
    if (args[index] === '--publish-gate-summary') {
      publishGateSummaryPath = args[index + 1] ?? ''
    }
    if (args[index] === '--publish-gate-summary-url') {
      publishGateSummaryUrl = args[index + 1] ?? ''
    }
  }
  return {
    diffPaths,
    syncStorePath: normalizeOptionalText(syncStorePath),
    issueInputPath: parseAliasedArgValue(
      issueInputPath,
      issueIndexPath,
      '--issue-input',
      '--issue-index',
      'issue input',
    ),
    issueLimit: parsePositiveInteger(issueLimit, DEFAULT_ISSUE_LIMIT, 'issue limit'),
    issuePacketOutPath: normalizeOptionalText(issuePacketOutPath),
    issueCsvOutPath: normalizeOptionalText(issueCsvOutPath),
    issuePacketIssueLimit: parsePositiveInteger(
      issuePacketIssueLimit,
      DEFAULT_PACKET_ISSUE_LIMIT,
      'issue packet issue limit',
    ),
    issueInputUrl: parseAliasedArgValue(
      issueInputUrl,
      issueIndexUrl,
      '--issue-input-url',
      '--issue-index-url',
      'issue input url',
    ),
    issuePacketUrl: normalizeOptionalText(issuePacketUrl),
    issueCsvUrl: normalizeOptionalText(issueCsvUrl),
    publishGateSummaryPath: normalizeOptionalText(publishGateSummaryPath),
    publishGateSummaryUrl: normalizeOptionalText(publishGateSummaryUrl),
  }
}
