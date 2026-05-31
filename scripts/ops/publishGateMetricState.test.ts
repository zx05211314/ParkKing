import { describe, expect, it } from 'vitest'
import { buildPublishGateMetricState } from './publishGateMetricState'

describe('publishGateMetricState', () => {
  it('extracts numeric metric fields and derives overrides ratio', () => {
    expect(
      buildPublishGateMetricState({
        segmentsCount: 10,
        overridesAppliedCount: 3,
        signOverridesCount: 4,
        signOverrideMatchedSegmentCount: 3,
        signOverrideSpatialMatchCount: 1,
        signOverrideUnmatchedNamedCount: 2,
        curbMarkingKnownRate: 0.5,
        restrictionTriggeredRate: 0.2,
      }),
    ).toEqual({
      segmentsCount: 10,
      overridesAppliedCount: 3,
      signOverridesCount: 4,
      signOverrideMatchedSegmentCount: 3,
      signOverrideSpatialMatchCount: 1,
      signOverrideUnmatchedNamedCount: 2,
      curbMarkingKnownRate: 0.5,
      restrictionTriggeredRate: 0.2,
      overridesRatio: 0.3,
    })
  })
})
