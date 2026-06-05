export const REVIEWED_CASE_HASH_MISMATCH_ENV =
  'PARKKING_ALLOW_REVIEWED_CASE_HASH_MISMATCH'

export const isTruthyReviewedCaseHashMismatch = (
  value: string | null | undefined,
) => {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export const resolveReviewedCaseHashMismatchAllowance = (
  optionValue: boolean | undefined,
  env: NodeJS.ProcessEnv = process.env,
) =>
  optionValue ??
  isTruthyReviewedCaseHashMismatch(env[REVIEWED_CASE_HASH_MISMATCH_ENV])
