export interface IssueReportArtifactSummaryJsonArgs {
  inputPath: string
  outPath: string | null
  json: boolean
  writeIndexSurface: boolean
}

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

export const parseIssueReportArtifactSummaryJsonArgs = (
  argv: string[],
): IssueReportArtifactSummaryJsonArgs => ({
  inputPath: normalizeRequiredText(
    parseAliasedArgValue(argv, '--input', '--summary', 'input'),
    'input',
  ),
  outPath: (() => {
    const value = parseArgValue(argv, '--out')
    if (!value) {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  })(),
  json: argv.includes('--json'),
  writeIndexSurface: argv.includes('--write-index-surface'),
})
