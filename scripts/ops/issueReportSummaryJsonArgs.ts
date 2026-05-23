export interface IssueReportSummaryJsonArgs {
  summaryPath: string
  outPath: string | null
  json: boolean
}

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const normalizeOptionalText = (value: string | null) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

export const parseIssueReportSummaryJsonArgs = (
  argv: string[],
): IssueReportSummaryJsonArgs => ({
  summaryPath: normalizeRequiredText(
    parseAliasedArgValue(argv, '--input', '--summary'),
    'input',
  ),
  outPath: normalizeOptionalText(parseArgValue(argv, '--out')),
  json: argv.includes('--json'),
})
