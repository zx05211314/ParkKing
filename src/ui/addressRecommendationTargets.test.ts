import { describe, expect, it } from 'vitest'
import { getAddressRecommendationTargets } from './addressRecommendationTargets'

describe('getAddressRecommendationTargets', () => {
  it('prefers the nearest marked space as the exact target', () => {
    const targets = getAddressRecommendationTargets(
      [
        {
          rank: 1,
          segment: {
            id: 'seg-a',
            path: [
              [121.56, 25.03],
              [121.561, 25.03],
            ],
          },
        },
      ],
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [121.5602, 25.03001],
            },
            properties: {
              stall_name: 'A-17',
              status_text: 'Open',
              fee_note: 'Paid 20 TWD/hr',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [121.5608, 25.03001],
            },
            properties: {},
          },
        ],
      },
      [121.5601, 25.0302],
    )

    expect(targets).toEqual([
      expect.objectContaining({
        rank: 1,
        targetKind: 'PARKING_SPACE',
        targetIndex: 1,
        targetLabel: 'A-17',
        targetMetadata: ['Open', 'Paid 20 TWD/hr'],
        destination: [121.5602, 25.03001],
      }),
    ])
  })

  it('falls back to a curb-segment arrival target when no spaces match', () => {
    const targets = getAddressRecommendationTargets(
      [
        {
          rank: 1,
          segment: {
            id: 'seg-b',
            path: [
              [121.56, 25.03],
              [121.561, 25.03],
            ],
          },
        },
      ],
      {
        type: 'FeatureCollection',
        features: [],
      },
      [121.5601, 25.0302],
    )

    expect(targets[0]).toEqual(
      expect.objectContaining({
        targetKind: 'SEGMENT',
        targetKey: null,
      }),
    )
    expect(targets[0].targetLabel).toMatch(/West end|East end|Mid-segment|North end|South end/)
  })
})
