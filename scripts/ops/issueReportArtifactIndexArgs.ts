export interface IssueReportArtifactIndexArgs {
  manifestPath: string
  outPath: string | null
  writeArtifactIndex: boolean
  json: boolean
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

export const parseIssueReportArtifactIndexArgs = (
  argv: string[],
): IssueReportArtifactIndexArgs => ({
  manifestPath: normalizeRequiredText(parseArgValue(argv, '--manifest'), 'manifest'),
  outPath: normalizeOptionalText(parseArgValue(argv, '--out')),
  writeArtifactIndex: argv.includes('--write-artifact-index'),
  json: argv.includes('--json'),
})
