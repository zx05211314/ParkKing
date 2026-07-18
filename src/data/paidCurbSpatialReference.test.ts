import { describe, expect, it } from 'vitest'
import {
  getTaoyuanDistrictPaidCurbSpatialReferenceUrl,
  parsePaidCurbSpatialReferencePack,
} from './paidCurbSpatialReference'

const pack = {
  type: 'FeatureCollection',
  metadata: {
    schemaVersion: 1,
    districtId: 'taoyuan-district',
    boundaryFeatureId: '68000010',
    evidenceKind: 'PAID_CURB_SEGMENT',
    sourceDataset: 'TDX OnStreet ParkingSegment v1',
    sourceSha256: 'a'.repeat(64),
    sourceFeatureCount: 2,
    reviewSha256: 'b'.repeat(64),
    reviewRecordCount: 2,
    featureCount: 1,
    excludedFeatureCount: 1,
    excluded: [
      {
        parkingSegmentId: 'outside',
        reason: 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY',
      },
    ],
    geometryPrecision: 'REPRESENTATIVE_POINT',
    legalAnswerEligible: false,
  },
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [121.3, 24.99] },
      properties: {
        evidenceKind: 'PAID_CURB_SEGMENT',
        parkingSegmentId: 'inside',
        districtId: 'taoyuan-district',
        description: 'Road A',
        fareDescription: null,
        hasChargingPoint: false,
        geometryPrecision: 'REPRESENTATIVE_POINT',
        legalAnswerEligible: false,
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
      },
    },
  ],
}

describe('paidCurbSpatialReference', () => {
  it('parses representative points that preserve the non-legal contract', () => {
    expect(parsePaidCurbSpatialReferencePack(pack)).toEqual(pack)
    expect(getTaoyuanDistrictPaidCurbSpatialReferenceUrl()).toBe(
      '/data/reference/taoyuan-district-paid-curb-points.geojson',
    )
  })

  it('rejects legal-answer eligibility and inconsistent counts', () => {
    expect(() =>
      parsePaidCurbSpatialReferencePack({
        ...pack,
        metadata: { ...pack.metadata, legalAnswerEligible: true },
      }),
    ).toThrow('Invalid paid-curb spatial reference metadata')
    expect(() =>
      parsePaidCurbSpatialReferencePack({
        ...pack,
        metadata: { ...pack.metadata, featureCount: 2 },
      }),
    ).toThrow('Invalid paid-curb spatial reference metadata')
  })

  it('rejects duplicate or cross-district feature IDs', () => {
    expect(() =>
      parsePaidCurbSpatialReferencePack({
        ...pack,
        features: [
          pack.features[0],
          {
            ...pack.features[0],
            properties: {
              ...pack.features[0]!.properties,
              districtId: 'other',
            },
          },
        ],
        metadata: {
          ...pack.metadata,
          reviewRecordCount: 3,
          featureCount: 2,
        },
      }),
    ).toThrow('Paid-curb spatial feature district does not match metadata')
  })
})
