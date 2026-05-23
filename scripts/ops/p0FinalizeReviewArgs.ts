import type { P0FinalizeReviewArgs } from './p0FinalizeReviewTypes'

const parseArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.findIndex((arg) => arg === flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

export const parseP0FinalizeReviewArgs = (argv: string[]): P0FinalizeReviewArgs => ({
  districtId: parseArgValue(argv, '--district', '--districtId', '--district-id'),
  sourcePath: parseArgValue(argv, '--source', '--sourcePath', '--source-path'),
  reviewsPath: parseArgValue(argv, '--reviews', '--reviewsPath', '--reviews-path'),
  mergedOutPath: parseArgValue(argv, '--merged-out', '--mergedOut', '--mergedOutPath'),
  configPath: parseArgValue(argv, '--config', '--configPath', '--config-path'),
  answerCasesPath: parseArgValue(
    argv,
    '--answer-cases',
    '--answerCases',
    '--answerCasesPath',
  ),
  outDir: parseArgValue(argv, '--out-dir', '--outDir'),
  publishReportPath: parseArgValue(
    argv,
    '--publish-report',
    '--publishReport',
    '--publishReportPath',
  ),
  noCleanup: argv.includes('--noCleanup') || argv.includes('--no-cleanup'),
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
