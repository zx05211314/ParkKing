import { featureCollection, lineString } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import type { FeatureCollection } from 'geojson'
import { bboxFromCollection, centerFromBBox } from './ingestGeoBounds'

describe('ingestGeoBounds', () => {
  it('builds a bbox from all collection coordinates', () => {
    const collection = featureCollection([
      lineString(
        [
          [121.5, 25.0],
          [121.6, 25.1],
        ],
        { id: 'a' },
      ),
      lineString(
        [
          [121.4, 24.9],
          [121.7, 25.2],
        ],
        { id: 'b' },
      ),
    ]) as FeatureCollection

    expect(bboxFromCollection(collection)).toEqual({
      minX: 121.4,
      minY: 24.9,
      maxX: 121.7,
      maxY: 25.2,
    })
  })

  it('computes bbox centers and handles empty collections', () => {
    expect(
      centerFromBBox({
        minX: 121.4,
        minY: 24.9,
        maxX: 121.8,
        maxY: 25.3,
      }),
    ).toEqual([121.6, 25.1])

    expect(bboxFromCollection(featureCollection([]) as FeatureCollection)).toBeNull()
    expect(centerFromBBox(null)).toBeNull()
  })
})
