import { describe, expect, it } from 'vitest'
import { buildPublishGateOverrideFeatureState } from './publishGateOverrideFeatureState'

describe('publishGateOverrideFeatureState', () => {
  it('normalizes segment id, status, and schema fields', () => {
    expect(
      buildPublishGateOverrideFeatureState({
        index: 2,
        properties: {
          segmentId: ' xinyi:seg-1 ',
          status: ' legal ',
          schema_version: '1',
        },
      }),
    ).toEqual({
      index: 2,
      segmentId: ' xinyi:seg-1 ',
      normalizedSegmentId: ' xinyi:seg-1 ',
      hasValidStatus: true,
      schemaRaw: '1',
      hasKnownSchemaVersion: true,
    })
  })
})
