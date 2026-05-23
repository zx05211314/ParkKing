import { describe, expect, it } from 'vitest'
import { buildPublishGateMetricWarnings } from './publishGateMetricWarnings'

describe('publishGateMetricWarnings', () => {
  it('builds low-coverage and high-override warnings from metric state', () => {
    expect(
      buildPublishGateMetricWarnings({
        districtId: 'xinyi',
        metrics: {
          segmentsCount: 10,
          overridesAppliedCount: 7,
          signOverridesCount: 7,
          signOverrideUnmatchedNamedCount: 2,
          curbMarkingKnownRate: 0.01,
          restrictionTriggeredRate: 0.001,
          overridesRatio: 0.7,
        },
      }).map((warning) => warning.code),
    ).toEqual([
      'METRIC_CURB_MARKING_LOW',
      'METRIC_RESTRICTION_LOW',
      'METRIC_OVERRIDES_HIGH',
      'METRIC_SIGN_OVERRIDE_UNMATCHED',
    ])
  })
})
