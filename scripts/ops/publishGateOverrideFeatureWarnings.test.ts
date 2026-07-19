import { describe, expect, it } from 'vitest'
import { buildPublishGateOverrideFeatureWarnings } from './publishGateOverrideFeatureWarnings'

describe('publishGateOverrideFeatureWarnings', () => {
  it('returns missing/invalid warnings from normalized feature state', () => {
    expect(
      buildPublishGateOverrideFeatureWarnings({
        districtId: 'xinyi',
        feature: {
          index: 0,
          segmentId: null,
          normalizedSegmentId: null,
          hasValidStatus: false,
          schemaRaw: null,
          schemaVersion: null,
          hasKnownSchemaVersion: false,
          reviewedSegmentId: null,
          normalizedReviewedSegmentId: null,
          reviewedHhmm: null,
          hasValidReviewedHhmm: false,
        },
        segmentIds: null,
      }).map((warning) => warning.code),
    ).toEqual([
      'OVERRIDES_SEGMENT_MISSING',
      'OVERRIDES_STATUS_INVALID',
      'OVERRIDES_SCHEMA_MISSING',
    ])
  })
})
