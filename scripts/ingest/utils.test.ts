import { featureCollection, point, polygon } from '@turf/turf'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { describe, expect, it } from 'vitest'
import { filterToBoundary } from './utils'

describe('ingest utils', () => {
  it('filters features to a boundary after bbox prefiltering', () => {
    const boundary = polygon(
      [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
      { id: 'boundary' },
    ) as Feature<Polygon>
    const inside = point([1, 1], { id: 'inside' })
    const crossing = polygon(
      [
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
      ],
      { id: 'crossing' },
    )
    const outside = polygon(
      [
        [
          [10, 10],
          [11, 10],
          [11, 11],
          [10, 11],
          [10, 10],
        ],
      ],
      { id: 'outside' },
    )
    const missingGeometry: Feature = {
      type: 'Feature',
      properties: { id: 'missingGeometry' },
      geometry: null,
    }

    const filtered = filterToBoundary(
      featureCollection([inside, crossing, outside, missingGeometry]) as FeatureCollection,
      boundary,
    )

    expect(filtered.features.map((feature) => feature.properties?.id)).toEqual([
      'inside',
      'crossing',
    ])
  })
})
