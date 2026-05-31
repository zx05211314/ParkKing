import { featureCollection, lineString, point } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import {
  assertCoordRanges,
  bboxFromGeometry,
  bboxIntersects,
  validateCollection,
} from './validateOutputCollections'

describe('validateOutputCollections', () => {
  it('computes geometry bboxes and intersection state', () => {
    const geometry = lineString([
      [121.5, 25.0],
      [121.6, 25.1],
    ]).geometry

    expect(bboxFromGeometry(geometry)).toEqual({
      minX: 121.5,
      minY: 25.0,
      maxX: 121.6,
      maxY: 25.1,
    })

    expect(
      bboxIntersects(
        { minX: 121.5, minY: 25.0, maxX: 121.6, maxY: 25.1 },
        { minX: 121.55, minY: 25.05, maxX: 121.7, maxY: 25.2 },
      ),
    ).toBe(true)
  })

  it('reports out-of-range coordinates and collection problems', () => {
    const errors: string[] = []
    assertCoordRanges(point([250000, 2650000]).geometry, 'sample', 0, errors)
    expect(errors[0]).toMatch(/out of WGS84 range/)

    const collectionErrors: string[] = []
    validateCollection(
      featureCollection([point([121.5, 25.0])]),
      'points',
      ['LineString'],
      { minX: 121.0, minY: 24.0, maxX: 122.0, maxY: 26.0 },
      2,
      collectionErrors,
    )

    expect(collectionErrors.some((entry) => entry.includes('below minimum 2'))).toBe(true)
    expect(collectionErrors.some((entry) => entry.includes('expected LineString'))).toBe(true)
  })
})
