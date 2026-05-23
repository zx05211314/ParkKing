import type { QaReviewGeojsonArgs } from './qaReviewGeojsonTypes'

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const parseQaReviewGeojsonArgs = (
  argv: string[],
): QaReviewGeojsonArgs => ({
  inputPath: parseArgValue(argv, '--input'),
  outPath: parseArgValue(argv, '--out'),
  json: argv.includes('--json'),
})
