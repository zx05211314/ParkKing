import { describe, expect, it } from 'vitest'
import type { PaidCurbSpatialReferencePack } from '../data/paidCurbSpatialReference'
import {
  getPaidCurbReferencePointStatus,
  resolvePaidCurbReferenceMapSelection,
} from './paidCurbReferenceMapSelection'

const pack: PaidCurbSpatialReferencePack = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [121.30074, 24.99493],
      },
      properties: {
        evidenceKind: 'PAID_CURB_SEGMENT',
        parkingSegmentId: '169',
        districtId: 'taoyuan-district',
        description: 'Road A',
        fareDescription: '20 per hour',
        hasChargingPoint: false,
        geometryPrecision: 'REPRESENTATIVE_POINT',
        legalAnswerEligible: false,
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
      },
    },
  ],
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
        parkingSegmentId: '177',
        reason: 'OUTSIDE_OFFICIAL_DISTRICT_BOUNDARY',
      },
    ],
    geometryPrecision: 'REPRESENTATIVE_POINT',
    legalAnswerEligible: false,
  },
}

describe('paidCurbReferenceMapSelection', () => {
  it('resolves only reviewed representative points', () => {
    expect(resolvePaidCurbReferenceMapSelection(pack, '169')).toEqual({
      parkingSegmentId: '169',
      coordinates: [121.30074, 24.99493],
    })
    expect(resolvePaidCurbReferenceMapSelection(pack, '177')).toBeNull()
    expect(resolvePaidCurbReferenceMapSelection(null, '169')).toBeNull()
  })

  it('distinguishes boundary exclusions from unavailable source rows', () => {
    expect(getPaidCurbReferencePointStatus(pack, '169')).toBe('AVAILABLE')
    expect(getPaidCurbReferencePointStatus(pack, '177')).toBe('EXCLUDED')
    expect(getPaidCurbReferencePointStatus(pack, 'missing')).toBe(
      'UNAVAILABLE',
    )
  })
})
