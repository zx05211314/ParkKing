import type { P0PrepareReviewArgs } from './p0PrepareReviewTypes'

const parseArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.findIndex((arg) => arg === flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const parseNonNegativeInteger = (
  value: string | null,
  label: string,
) => {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return parsed
}

export const parseP0PrepareReviewArgs = (argv: string[]): P0PrepareReviewArgs => ({
  districtId: parseArgValue(argv, '--district', '--districtId', '--district-id'),
  sourcePath: parseArgValue(argv, '--source', '--review', '--reviewPath', '--review-path'),
  manifestPath: parseArgValue(argv, '--manifest', '--manifestPath', '--manifest-path'),
  configPath: parseArgValue(argv, '--config', '--configPath', '--config-path'),
  nextReviewOutPath: parseArgValue(
    argv,
    '--next-review-out',
    '--nextReviewOut',
    '--nextReviewOutPath',
  ),
  checklistOutPath: parseArgValue(
    argv,
    '--checklist-out',
    '--checklistOut',
    '--checklistOutPath',
  ),
  geojsonOutPath: parseArgValue(
    argv,
    '--geojson-out',
    '--geojsonOut',
    '--geojsonOutPath',
  ),
  mergedOutPath: parseArgValue(argv, '--merged-out', '--mergedOut', '--mergedOutPath'),
  nextReviewRowsLimit: parseNonNegativeInteger(
    parseArgValue(argv, '--next-review-limit', '--nextReviewRowsLimit'),
    'next-review-limit',
  ),
  json: argv.includes('--json'),
})
