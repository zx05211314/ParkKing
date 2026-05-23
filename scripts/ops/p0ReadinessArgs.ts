import type { P0ReadinessArgs } from './p0ReadinessTypes'

const parseArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.findIndex((arg) => arg === flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const parseNumericArg = (argv: string[], ...flags: string[]) => {
  const value = parseArgValue(argv, ...flags)
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flags[0]} must be a finite number`)
  }
  return parsed
}

export const parseP0ReadinessArgs = (argv: string[]): P0ReadinessArgs => ({
  districtId: parseArgValue(argv, '--district', '--districtId', '--district-id'),
  datasetDir: parseArgValue(argv, '--datasetDir', '--dataset-dir'),
  reviewPath: parseArgValue(argv, '--review', '--reviewPath', '--review-path'),
  manifestPath: parseArgValue(argv, '--manifest', '--manifestPath', '--manifest-path'),
  configPath: parseArgValue(argv, '--config', '--configPath', '--config-path'),
  publishReportPath: parseArgValue(
    argv,
    '--publish-report',
    '--publishReport',
    '--publishReportPath',
  ),
  answerCasesPath: parseArgValue(
    argv,
    '--answer-cases',
    '--answerCases',
    '--answerCasesPath',
  ),
  hhmm: parseArgValue(argv, '--hhmm'),
  searchRadiusMeters: parseNumericArg(argv, '--radius', '--searchRadiusMeters'),
  nextReviewRowsLimit: parseNumericArg(argv, '--next-review-limit'),
  allowPublishWarn:
    argv.includes('--allow-publish-warn') || argv.includes('--allowPublishWarn'),
  allowPublishFail:
    argv.includes('--allow-publish-fail') || argv.includes('--allowPublishFail'),
  publishOverrideReason: parseArgValue(
    argv,
    '--publish-override',
    '--publishOverride',
    '--override',
  ),
  json: argv.includes('--json'),
})
