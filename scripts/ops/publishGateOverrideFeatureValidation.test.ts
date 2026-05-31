import { describe, expect, it } from 'vitest'
import { validatePublishGateOverrideFeatures } from './publishGateOverrideFeatureValidation'

describe('publishGateOverrideFeatureValidation', () => {
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
