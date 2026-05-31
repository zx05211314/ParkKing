import { describe, expect, it } from 'vitest'
import {
  buildOverridesRatioIssue,
  buildSegmentDeltaIssues,
  buildSignOverrideMismatchIssues,
} from './diffPackDistrictIssueBuilders'

describe('diffPackDistrictIssueBuilders', () => {
  it('builds segment delta fail and warn issues', () => {
    expect(
      buildSegmentDeltaIssues({
        districtId: 'beta',
        segmentsCount: { prev: 10, next: 0, delta: -10, deltaPct: -1 },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_SEGMENTS_ZERO', 'DIFF_SEGMENTS_DELTA_PCT'])
  })

  it('builds an overrides ratio issue only when the ratio is high', () => {
    expect(
      buildOverridesRatioIssue({
        districtId: 'beta',
        segmentsCount: { prev: 10, next: 10, delta: 0, deltaPct: 0 },
        overridesAppliedCount: { prev: 0, next: 4, delta: 4, deltaPct: null },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_OVERRIDES_RATIO_HIGH'])
  })

  it('builds a named sign override mismatch issue only when mismatches increase', () => {
    expect(
      buildSignOverrideMismatchIssues({
        districtId: 'beta',
        signOverrideUnmatchedNamedCount: {
          prev: 1,
          next: 3,
          delta: 2,
          deltaPct: 2,
        },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_SIGN_OVERRIDE_UNMATCHED_INCREASE'])
  })
})
