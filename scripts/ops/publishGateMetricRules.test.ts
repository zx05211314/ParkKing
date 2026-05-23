import { describe, expect, it } from 'vitest'
import { validatePublishGateMetricMetadata } from './publishGateMetricRules'

describe('validatePublishGateMetricMetadata', () => {
  it('flags low metric coverage and high overrides ratio', () => {
    expect(
      validatePublishGateMetricMetadata('xinyi', {
        segmentsCount: 10,
        overridesAppliedCount: 7,
        signOverridesCount: 7,
        signOverrideUnmatchedNamedCount: 1,
        curbMarkingKnownRate: 0.01,
        restrictionTriggeredRate: 0.001,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'METRIC_CURB_MARKING_LOW' }),
        expect.objectContaining({ code: 'METRIC_RESTRICTION_LOW' }),
        expect.objectContaining({ code: 'METRIC_OVERRIDES_HIGH' }),
        expect.objectContaining({ code: 'METRIC_SIGN_OVERRIDE_UNMATCHED' }),
      ]),
    )
  })
})
