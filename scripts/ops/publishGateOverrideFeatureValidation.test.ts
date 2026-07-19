import { describe, expect, it } from 'vitest'
import { validatePublishGateOverrideFeatures } from './publishGateOverrideFeatureValidation'

describe('publishGateOverrideFeatureValidation', () => {
  it('accepts scoped schema-v2 overrides', () => {
    expect(
      validatePublishGateOverrideFeatures({
        districtId: 'xinyi',
        features: [
          {
            properties: {
              segmentId: 'seg-1',
              override_status: 'LEGAL',
              override_schema_version: 2,
              override_reviewed_segment_id: 'seg-1-part-2',
              override_reviewed_hhmm: '21:00',
            },
          },
        ],
        segmentIds: new Set(['seg-1']),
      }),
    ).toEqual([])
  })

  it('rejects schema-v2 overrides without a valid matching review scope', () => {
    expect(
      validatePublishGateOverrideFeatures({
        districtId: 'xinyi',
        features: [
          {
            properties: {
              segmentId: 'seg-1',
              override_status: 'LEGAL',
              override_schema_version: 2,
              override_reviewed_segment_id: 'seg-2-part-1',
              override_reviewed_hhmm: '25:00',
            },
          },
          {
            properties: {
              segmentId: 'seg-3',
              override_status: 'ILLEGAL',
              override_schema_version: 2,
            },
          },
        ],
        segmentIds: new Set(['seg-1', 'seg-3']),
      }).map((warning) => warning.code),
    ).toEqual([
      'OVERRIDES_REVIEW_TARGET_MISMATCH',
      'OVERRIDES_REVIEW_TIME_INVALID',
      'OVERRIDES_REVIEW_TARGET_MISSING',
      'OVERRIDES_REVIEW_TIME_INVALID',
    ])
  })

  it('flags invalid override feature properties and unknown segment ids', () => {
    expect(
      validatePublishGateOverrideFeatures({
        districtId: 'xinyi',
        features: [
          {
            properties: {
              segmentId: 'missing-segment',
              override_status: 'bad',
              override_schema_version: 9,
            },
          },
        ],
        segmentIds: new Set(['seg-1']),
      }).map((warning) => warning.code),
    ).toEqual([
      'OVERRIDES_SEGMENT_UNKNOWN',
      'OVERRIDES_STATUS_INVALID',
      'OVERRIDES_SCHEMA_UNKNOWN',
    ])
  })
})
