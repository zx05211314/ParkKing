import { describe, expect, it } from 'vitest'
import { normalizeTaoyuanPaidCurbSegments } from './fetchTaoyuanPaidCurbSegments'

describe('fetchTaoyuanPaidCurbSegments', () => {
  it('normalizes exact and representative geometry without claiming legal evidence', () => {
    const collection = normalizeTaoyuanPaidCurbSegments({
      SrcUpdateTime: '2026-07-15T20:00:00+08:00',
      UpdateTime: '2026-07-15T20:05:00+08:00',
      AuthorityCode: 'TAO',
      VersionID: 7,
      Count: 2,
      Items: [
        {
          ParkingSegmentID: 'segment-point',
          ParkingSegmentName: { Zh_tw: 'Road A', En: 'Road A' },
          ParkingSegmentPosition: { PositionLon: 121.301, PositionLat: 24.993 },
          FareDescription: 'Hourly fee',
          City: 'Taoyuan',
          CityCode: 'TAO',
          TownName: 'Taoyuan District',
          TownID: 'H01',
        },
        {
          ParkingSegmentID: 'segment-line',
          ParkingSegmentName: { En: 'Road B' },
          ParkingSegmentPosition: { PositionLon: 121.302, PositionLat: 24.994 },
          Geometry: 'LINESTRING (121.302 24.994, 121.303 24.995)',
          RoadSection: { Start: 'A Street', End: 'B Street' },
          HasChargingPoint: 1,
        },
      ],
    })

    expect(collection.features).toHaveLength(2)
    expect(collection.features[0]?.geometry.type).toBe('Point')
    expect(collection.features[0]?.properties.geometryPrecision).toBe(
      'REPRESENTATIVE_POINT',
    )
    expect(collection.features[1]?.geometry.type).toBe('LineString')
    expect(collection.features[1]?.properties.geometryPrecision).toBe(
      'SEGMENT_GEOMETRY',
    )
    expect(collection.features.every(({ properties }) => !properties.legalAnswerEligible)).toBe(
      true,
    )
    expect(collection.features.every(({ properties }) => properties.evidenceKind === 'PAID_CURB_SEGMENT')).toBe(
      true,
    )
    expect(collection.metadata).toMatchObject({
      authorityCode: 'TAO',
      sourceRecordCount: 2,
      featureCount: 2,
      legalAnswerEligible: false,
    })
  })

  it('drops records that have neither usable geometry nor a representative point', () => {
    const collection = normalizeTaoyuanPaidCurbSegments({
      Items: [
        {
          ParkingSegmentID: 'invalid',
          ParkingSegmentPosition: { PositionLon: 'not-a-number', PositionLat: 24.99 },
        },
      ],
    })

    expect(collection.features).toEqual([])
    expect(collection.metadata.sourceRecordCount).toBe(1)
  })
})
