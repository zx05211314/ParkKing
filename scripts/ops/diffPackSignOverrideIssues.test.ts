import { describe, expect, it } from 'vitest'
import { buildSignOverrideMismatchIssues } from './diffPackSignOverrideIssues'

describe('diffPackSignOverrideIssues', () => {
  it('warns when unmatched named sign overrides increase', () => {
    expect(
      buildSignOverrideMismatchIssues({
        districtId: 'xinyi',
        signOverrideUnmatchedNamedCount: {
          prev: 0,
          next: 2,
          delta: 2,
          deltaPct: null,
        },
      }),
    ).toEqual([
      expect.objectContaining({
        severity: 'WARN',
        code: 'DIFF_SIGN_OVERRIDE_UNMATCHED_INCREASE',
      }),
    ])
  })

  it('does nothing when unmatched named sign overrides are flat or improve', () => {
    expect(
      buildSignOverrideMismatchIssues({
        districtId: 'xinyi',
        signOverrideUnmatchedNamedCount: {
          prev: 2,
          next: 2,
          delta: 0,
          deltaPct: 0,
        },
      }),
    ).toEqual([])

    expect(
      buildSignOverrideMismatchIssues({
        districtId: 'xinyi',
        signOverrideUnmatchedNamedCount: {
          prev: 2,
          next: 1,
          delta: -1,
          deltaPct: -0.5,
        },
      }),
    ).toEqual([])
  })
})
