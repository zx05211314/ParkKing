import { describe, expect, it } from 'vitest'
import {
  REVIEWED_CASE_HASH_MISMATCH_ENV,
  resolveReviewedCaseHashMismatchAllowance,
} from './reviewedCaseHashMismatch'

describe('reviewedCaseHashMismatch', () => {
  it('uses explicit option values before env defaults', () => {
    expect(
      resolveReviewedCaseHashMismatchAllowance(false, {
        [REVIEWED_CASE_HASH_MISMATCH_ENV]: 'true',
      }),
    ).toBe(false)
    expect(resolveReviewedCaseHashMismatchAllowance(true, {})).toBe(true)
  })

  it('accepts truthy workflow env values when the option is omitted', () => {
    expect(
      resolveReviewedCaseHashMismatchAllowance(undefined, {
        [REVIEWED_CASE_HASH_MISMATCH_ENV]: 'true',
      }),
    ).toBe(true)
    expect(
      resolveReviewedCaseHashMismatchAllowance(undefined, {
        [REVIEWED_CASE_HASH_MISMATCH_ENV]: '1',
      }),
    ).toBe(true)
    expect(resolveReviewedCaseHashMismatchAllowance(undefined, {})).toBe(false)
  })
})
