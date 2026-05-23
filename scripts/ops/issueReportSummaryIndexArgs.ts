export interface IssueReportSummaryIndexArgs {
  summaryPath: string
  outPath: string | null
  indexBaseUrl: string | null
  json: boolean
  topCount: number
  writeIndex: boolean
}

const DEFAULT_TOP_COUNT = 5

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const parseAliasedArgValue = (
  argv: string[],
  primaryFlag: string,
  aliasFlag: string,
) => {
  const primaryValue = normalizeOptionalText(parseArgValue(argv, primaryFlag))
  const aliasValue = normalizeOptionalText(parseArgValue(argv, aliasFlag))
  if (primaryValue && aliasValue && primaryValue !== aliasValue) {
    throw new Error(`${primaryFlag} conflicts with ${aliasFlag}`)
  }
  return primaryValue ?? aliasValue ?? null
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

export const parseIssueReportSummaryIndexArgs = (
  argv: string[],
): IssueReportSummaryIndexArgs => {
  const json = argv.includes('--json')
  const writeIndex = argv.includes('--write-index')
  if (writeIndex && !json) {
    throw new Error('write index requires --json')
  }

  return {
    summaryPath: normalizeRequiredText(
      parseAliasedArgValue(argv, '--input', '--summary'),
      'input',
    ),
    outPath: normalizeOptionalText(parseArgValue(argv, '--out')),
    indexBaseUrl: normalizeOptionalText(parseArgValue(argv, '--index-base-url')),
    json,
    topCount: parsePositiveInteger(
      parseArgValue(argv, '--top-count'),
      DEFAULT_TOP_COUNT,
      'top count',
    ),
    writeIndex,
  }
}
