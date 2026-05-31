import { describe, expect, it } from 'vitest'
import { buildOverridesRatioIssue } from './diffPackOverrideRatioIssue'

describe('diffPackOverrideRatioIssue', () => {
  it('emits an issue only when overrides exceed the allowed ratio', () => {
    expect(
      buildOverridesRatioIssue({
        districtId: 'beta',
        segmentsCount: { prev: 10, next: 10, delta: 0, deltaPct: 0 },
        overridesAppliedCount: { prev: 0, next: 4, delta: 4, deltaPct: null },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_OVERRIDES_RATIO_HIGH'])
  })
})
