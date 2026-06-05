import { describe, expect, it } from 'vitest'
import {
  ANSWER_CASE_REVIEW_FALLBACK_ENV,
  resolveAnswerCaseReviewFallbackAllowance,
} from './answerCaseReviewFallback'

describe('answerCaseReviewFallback', () => {
  it('uses explicit option values before env defaults', () => {
    expect(
      resolveAnswerCaseReviewFallbackAllowance(false, {
        [ANSWER_CASE_REVIEW_FALLBACK_ENV]: 'true',
      }),
    ).toBe(false)
    expect(resolveAnswerCaseReviewFallbackAllowance(true, {})).toBe(true)
  })

  it('accepts truthy workflow env values when the option is omitted', () => {
    expect(
      resolveAnswerCaseReviewFallbackAllowance(undefined, {
        [ANSWER_CASE_REVIEW_FALLBACK_ENV]: 'true',
      }),
    ).toBe(true)
    expect(
      resolveAnswerCaseReviewFallbackAllowance(undefined, {
        [ANSWER_CASE_REVIEW_FALLBACK_ENV]: '1',
      }),
    ).toBe(true)
    expect(resolveAnswerCaseReviewFallbackAllowance(undefined, {})).toBe(false)
  })
})
