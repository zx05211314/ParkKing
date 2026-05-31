import { describe, expect, it } from 'vitest'
import { buildDiffPackCountDiffs } from './diffPackMetricCountState'

describe('diffPackMetricCountState', () => {
  it('builds count deltas from mixed direct and counts-based shapes', () => {
    const counts = buildDiffPackCountDiffs(
      {
        counts: {
          segments: 100,
          overridesApplied: 5,
          signOverrides: 2,
          signOverrideMatchedSegmentCount: 2,
          signOverrideSpatialMatchCount: 0,
          signOverrideUnmatchedNamedCount: 0,
        },
      },
      {
        segmentsCount: 110,
        overridesAppliedCount: 7,
        signOverridesCount: 3,
        signOverrideMatchedSegmentCount: 2,
        signOverrideSpatialMatchCount: 1,
        signOverrideUnmatchedNamedCount: 2,
      },
    )

    expect(counts.segmentsCount).toMatchObject({ prev: 100, next: 110, delta: 10 })
    expect(counts.overridesAppliedCount).toMatchObject({ prev: 5, next: 7, delta: 2 })
    expect(counts.signOverridesCount).toMatchObject({ prev: 2, next: 3, delta: 1 })
    expect(counts.signOverrideMatchedSegmentCount).toMatchObject({
      prev: 2,
      next: 2,
      delta: 0,
    })
    expect(counts.signOverrideSpatialMatchCount).toMatchObject({
      prev: 0,
      next: 1,
      delta: 1,
    })
    expect(counts.signOverrideUnmatchedNamedCount).toMatchObject({
      prev: 0,
      next: 2,
      delta: 2,
    })
  })
})
