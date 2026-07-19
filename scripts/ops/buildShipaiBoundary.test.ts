import { featureCollection, polygon } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import {
  buildShipaiAreaBoundary,
  SHIPAI_MEMBER_VILLAGE_CODES,
} from './buildShipaiBoundary'

const neighborhoods = featureCollection(
  SHIPAI_MEMBER_VILLAGE_CODES.map((villageCode, index) => {
    const west = 121.49 + index * 0.001
    return polygon(
      [
        [
          [west, 25.1],
          [west + 0.0009, 25.1],
          [west + 0.0009, 25.101],
          [west, 25.101],
          [west, 25.1],
        ],
      ],
      {
        SECT_CODE: '6301200',
        LIE_CODE: villageCode,
        SDFKEY: `${villageCode}001`,
      },
    )
  }),
)

const parentBoundaries = featureCollection([
  polygon(
    [
      [
        [121.489, 25.099],
        [121.5008, 25.099],
        [121.5008, 25.102],
        [121.489, 25.102],
        [121.489, 25.099],
      ],
    ],
    { PERF_ID: '63012' },
  ),
])

describe('buildShipaiAreaBoundary', () => {
  it('unions all official villages and clips source-edge drift to Beitou', () => {
    const result = buildShipaiAreaBoundary({
      neighborhoods,
      parentBoundaries,
      sourceSha256: 'a'.repeat(64),
    })

    expect(result.selectedVillageCount).toBe(11)
    expect(result.selectedFeatureCount).toBe(11)
    expect(result.clippedOutsideSquareMeters).toBeGreaterThan(0)
    expect(result.pack.metadata).toMatchObject({
      areaId: 'shipai',
      parentDistrictId: 'beitou',
      selectedFeatureCount: 11,
      parkingAnswerOwnerDistrictId: 'beitou',
    })
    expect(result.pack.metadata.memberFeatureIds).toEqual([
      ...SHIPAI_MEMBER_VILLAGE_CODES,
    ])
  })

  it('fails closed when an official member village is missing', () => {
    expect(() =>
      buildShipaiAreaBoundary({
        neighborhoods: featureCollection(neighborhoods.features.slice(1)),
        parentBoundaries,
        sourceSha256: 'a'.repeat(64),
      }),
    ).toThrow('missing official member village codes')
  })
})
