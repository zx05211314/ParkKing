export const ANSWER_CASE_REVIEW_FALLBACK_ENV =
  'PARKKING_ALLOW_ANSWER_CASE_REVIEW_FALLBACK'

export const isTruthyAnswerCaseReviewFallback = (
  value: string | null | undefined,
) => {
  const normalized = value?.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export const resolveAnswerCaseReviewFallbackAllowance = (
  optionValue: boolean | undefined,
  env: NodeJS.ProcessEnv = process.env,
) =>
  optionValue ??
  isTruthyAnswerCaseReviewFallback(env[ANSWER_CASE_REVIEW_FALLBACK_ENV])
