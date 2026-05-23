import type { QaReviewChecklistArgs } from './qaReviewChecklistTypes'

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

export const parseQaReviewChecklistArgs = (
  argv: string[],
): QaReviewChecklistArgs => ({
  inputPath: parseArgValue(argv, '--input'),
  sourcePath: parseArgValue(argv, '--source'),
  outPath: parseArgValue(argv, '--out'),
  mergedOutPath: parseArgValue(argv, '--merged-out'),
  configPath: parseArgValue(argv, '--config'),
  title: parseArgValue(argv, '--title'),
  json: argv.includes('--json'),
})
