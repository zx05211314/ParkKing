export interface IssueReportSummaryArtifactsArgs {
  inputPath?: string
  summaryPath?: string
  label: string | null
  inputUrl: string | null
  publishGateSummaryUrl: string | null
  topCount: number
  indexBaseUrl: string | null
}

const DEFAULT_TOP_COUNT = 5

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const normalizeRequiredText = (value: string | null, label: string) => {
  if (!value) {
    throw new Error(`${label} is required`)
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${label} is required`)
  }
  return trimmed
}

const normalizeOptionalText = (value: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

const normalizeOptionalBaseUrl = (value: string | null) =>
  normalizeOptionalText(value)?.replace(/\/+$/, '') ?? null

const parseAliasedArgValue = (
  argv: string[],
  primaryFlag: string,
  legacyFlag: string,
  label: string,
) => {
  const primaryValue = normalizeOptionalText(parseArgValue(argv, primaryFlag))
  const legacyValue = normalizeOptionalText(parseArgValue(argv, legacyFlag))

  if (
    primaryValue !== null &&
    legacyValue !== null &&
    primaryValue !== legacyValue
  ) {
    throw new Error(`${label} must not conflict between ${primaryFlag} and ${legacyFlag}`)
  }

  return primaryValue ?? legacyValue
}

export const parseIssueReportSummaryArtifactsArgs = (
  argv: string[],
): IssueReportSummaryArtifactsArgs => ({
  inputPath: normalizeRequiredText(
    parseAliasedArgValue(argv, '--input', '--summary', 'input'),
    'input',
  ),
  label: normalizeOptionalText(parseArgValue(argv, '--label')),
  inputUrl: normalizeOptionalText(parseArgValue(argv, '--input-url')),
  publishGateSummaryUrl: normalizeOptionalText(
    parseArgValue(argv, '--publish-gate-summary-url'),
  ),
  topCount: parsePositiveInteger(
    parseArgValue(argv, '--top-count'),
    DEFAULT_TOP_COUNT,
    'top count',
  ),
  indexBaseUrl: normalizeOptionalBaseUrl(parseArgValue(argv, '--index-base-url')),
})
