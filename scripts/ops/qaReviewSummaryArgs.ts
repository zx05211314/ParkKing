import {
  type QaReviewSummaryArgs,
  VALID_QA_REVIEW_STATUSES,
} from './qaReviewSummaryTypes'

const parseArgValue = (argv: string[], flag: string) => {
  const index = argv.findIndex((arg) => arg === flag)
  return index >= 0 ? argv[index + 1] ?? null : null
}

const parseArgValues = (argv: string[], flag: string) => {
  const values: string[] = []
  argv.forEach((arg, index) => {
    if (arg === flag) {
      const value = argv[index + 1]
      if (value) {
        values.push(value)
      }
    }
  })
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

const parseNonNegativeInteger = (
  value: string | null,
  fallback: number,
  label: string,
) => {
  if (value === null) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
  return parsed
}

const normalizeStatuses = (values: string[]) =>
  values.map((value) => value.trim().toUpperCase()).filter(Boolean)

const parseBucketMinimums = (values: string[]) => {
  const minimums: Record<string, number> = {}
  values.forEach((value) => {
    const separator = value.indexOf('=')
    if (separator <= 0) {
      throw new Error('min-reviewed-bucket must use bucket=count')
    }
    const bucket = value.slice(0, separator).trim()
    const rawCount = value.slice(separator + 1).trim()
    const count = Number(rawCount)
    if (!bucket || !Number.isInteger(count) || count < 0) {
      throw new Error('min-reviewed-bucket must use bucket=count with a non-negative integer count')
    }
    minimums[bucket] = Math.max(minimums[bucket] ?? 0, count)
  })
  return minimums
}

export const parseQaReviewSummaryArgs = (argv: string[]): QaReviewSummaryArgs => {
  const requireStatuses = normalizeStatuses(parseArgValues(argv, '--require-status'))
  const invalidStatus = requireStatuses.find(
    (status) => !VALID_QA_REVIEW_STATUSES.includes(status as never),
  )
  if (invalidStatus) {
    throw new Error('require-status must be LEGAL, ILLEGAL, or UNCLEAR')
  }

  return {
    inputPath: parseArgValue(argv, '--input'),
    manifestPath: parseArgValue(argv, '--manifest'),
    strictManifest: argv.includes('--strict-manifest'),
    strictReviewedRows: argv.includes('--strict-reviewed-rows'),
    strictReviewedSegments: argv.includes('--strict-reviewed-segments'),
    nextReviewRowsLimit: parseNonNegativeInteger(
      parseArgValue(argv, '--next-review-limit'),
      10,
      'next-review-limit',
    ),
    nextReviewOutPath: parseArgValue(argv, '--next-review-out'),
    outPath: parseArgValue(argv, '--out'),
    json: argv.includes('--json'),
    minReviewed: parseNonNegativeInteger(
      parseArgValue(argv, '--min-reviewed'),
      1,
      'min-reviewed',
    ),
    requireStatuses,
    requireBuckets: parseArgValues(argv, '--require-bucket'),
    minReviewedBuckets: parseBucketMinimums(
      parseArgValues(argv, '--min-reviewed-bucket'),
    ),
  }
}
