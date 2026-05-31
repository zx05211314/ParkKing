import { featureCollection, lineString, point } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import type { FeatureCollection } from 'geojson'
import { EPSG_3826, EPSG_4326 } from './ingestCrs'
import {
  detectCrsFromPrj,
  isLikelyLngLat,
  normalizeFeatures,
  sampleCoordFromCollection,
  shouldTransformGeometry,
} from './ingestCoordinateTransforms'

describe('ingestCoordinateTransforms', () => {
  it('detects CRS from PRJ text and falls back cleanly', () => {
    expect(detectCrsFromPrj('GEOGCS["WGS_1984"]', EPSG_3826)).toBe(EPSG_4326)
    expect(detectCrsFromPrj('PROJCS["TWD97 / TM2 zone 121"]', EPSG_4326)).toBe(EPSG_3826)
    expect(detectCrsFromPrj(null, EPSG_4326)).toBe(EPSG_4326)
  })

  it('samples coordinates and detects transform-needed geometry', () => {
    const collection = featureCollection([
      lineString(
        [
          [250000, 2650000],
          [250100, 2650100],
        ],
        { id: 'segment' },
      ),
    ]) as FeatureCollection

    expect(sampleCoordFromCollection(collection)).toEqual([250000, 2650000])
    expect(shouldTransformGeometry(collection.features[0]!.geometry!)).toBe(true)
    expect(isLikelyLngLat([121.5, 25.0])).toBe(true)
    expect(isLikelyLngLat([250000, 2650000])).toBe(false)
  })

  it('normalizes projected coordinates to lng/lat', () => {
    const collection = featureCollection([point([250000, 2650000])]) as FeatureCollection
    const normalized = normalizeFeatures(collection, EPSG_3826)
    const coord = sampleCoordFromCollection(normalized)

    expect(coord).not.toBeNull()
    expect(Math.abs(coord![0])).toBeLessThanOrEqual(180)
    expect(Math.abs(coord![1])).toBeLessThanOrEqual(90)
  })
})
