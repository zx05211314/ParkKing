import { describe, expect, it } from 'vitest'
import {
  validatePublishGateBoundaryMetadata,
  validatePublishGateCountMetadata,
  validatePublishGateMetricMetadata,
} from './publishGatePackMetadata'

describe('publishGatePackMetadata', () => {
  it('flags invalid boundary center values', () => {
    expect(
      validatePublishGateBoundaryMetadata('xinyi', {
        boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        boundaryCenter: [5, 5],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_BOUNDARY_CENTER_OUTSIDE' }),
      ]),
    )
  })

  it('flags missing and out-of-range count metadata', () => {
    const result = validatePublishGateCountMetadata('xinyi', {
      counts: {
        segments: 0,
        busStops: 1,
        hydrants: 1,
        intersections: 1,
        inferredCandidates: 1_000_001,
        signOverrides: 0,
        overridesApplied: 0,
        crosswalks: 0,
      },
    })

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'META_COUNTS_EMPTY' }),
        expect.objectContaining({ code: 'META_COUNTS_HIGH' }),
      ]),
    )
  })

  it('flags low metric coverage and high override ratio', () => {
    expect(
      validatePublishGateMetricMetadata('xinyi', {
        segmentsCount: 10,
        overridesAppliedCount: 6,
        signOverridesCount: 6,
        signOverrideUnmatchedNamedCount: 2,
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
