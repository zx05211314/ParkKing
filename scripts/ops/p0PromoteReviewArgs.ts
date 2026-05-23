import type { P0PromoteReviewArgs } from './p0PromoteReviewTypes'

const parseArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.findIndex((arg) => arg === flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

export const parseP0PromoteReviewArgs = (
  argv: string[],
): P0PromoteReviewArgs => ({
  districtId: parseArgValue(argv, '--district', '--districtId', '--district-id'),
  sourcePath: parseArgValue(argv, '--source', '--sourcePath', '--source-path'),
  reviewsPath: parseArgValue(argv, '--reviews', '--reviewsPath', '--reviews-path'),
  mergedOutPath: parseArgValue(
    argv,
    '--merged-out',
    '--mergedOut',
    '--mergedOutPath',
  ),
  configPath: parseArgValue(argv, '--config', '--configPath', '--config-path'),
  outDir: parseArgValue(argv, '--outDir', '--out-dir'),
  json: argv.includes('--json'),
})
