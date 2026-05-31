import type { QaReviewApplyArgs } from './qaReviewApplyTypes'

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const parseQaReviewApplyArgs = (argv: string[]): QaReviewApplyArgs => ({
  sourcePath: parseArgValue(argv, '--source'),
  reviewsPath: parseArgValue(argv, '--reviews'),
  outPath: parseArgValue(argv, '--out'),
  allowOverwrite: argv.includes('--allow-overwrite'),
  json: argv.includes('--json'),
})
