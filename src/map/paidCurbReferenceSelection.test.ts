import { describe, expect, it } from 'vitest'
import { parsePaidCurbReferencePointSelection } from './paidCurbReferenceSelection'

const feature = {
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
}

describe('paidCurbReferenceSelection', () => {
  it('extracts display-safe fields from a non-legal representative point', () => {
    expect(parsePaidCurbReferencePointSelection(feature)).toEqual({
      parkingSegmentId: '169',
      districtId: 'taoyuan-district',
      description: 'Road A',
      fareDescription: '20 per hour',
      hasChargingPoint: false,
      coordinates: [121.30074, 24.99493],
    })
  })

  it('rejects legal, non-point, or malformed reference features', () => {
    expect(
      parsePaidCurbReferencePointSelection({
        ...feature,
        properties: {
          ...feature.properties,
          legalAnswerEligible: true,
        },
      }),
    ).toBeNull()
    expect(
      parsePaidCurbReferencePointSelection({
        ...feature,
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.3, 24.99],
            [121.31, 25],
          ],
        },
      }),
    ).toBeNull()
    expect(
      parsePaidCurbReferencePointSelection({
        ...feature,
        properties: {
          ...feature.properties,
          parkingSegmentId: '',
        },
      }),
    ).toBeNull()
  })

  it('treats an omitted vector-tile null fare as not listed', () => {
    const properties: Partial<typeof feature.properties> = {
      ...feature.properties,
    }
    delete properties.fareDescription
    expect(
      parsePaidCurbReferencePointSelection({
        ...feature,
        properties,
      }),
    ).toMatchObject({
      parkingSegmentId: '169',
      fareDescription: null,
    })
  })
})
