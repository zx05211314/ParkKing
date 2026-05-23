export interface IssueReportArtifactManifestArgs {
  manifestPath: string
  expectKind: 'any' | 'workflow' | 'manual' | 'packet'
  followPacketManifest: boolean
  followSummaryArtifacts: boolean
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

const parseExpectKind = (value: string | null): IssueReportArtifactManifestArgs['expectKind'] => {
  if (!value) {
    return 'any'
  }
  if (value === 'any' || value === 'workflow' || value === 'manual' || value === 'packet') {
    return value
  }
  throw new Error('expect must be one of: any, workflow, manual, packet')
}

export const parseIssueReportArtifactManifestArgs = (
  argv: string[],
): IssueReportArtifactManifestArgs => ({
  manifestPath: normalizeRequiredText(parseArgValue(argv, '--manifest'), 'manifest'),
  expectKind: parseExpectKind(parseArgValue(argv, '--expect')),
  followPacketManifest: argv.includes('--follow-packet'),
  followSummaryArtifacts: argv.includes('--follow-surface'),
  json: argv.includes('--json'),
})
