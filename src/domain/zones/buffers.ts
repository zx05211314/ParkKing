import { buffer, point } from '@turf/turf'
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson'

export const createBufferPolygon = (
  center: [number, number],
  radiusMeters: number,
): Feature<Polygon | MultiPolygon> => {
  const result = buffer(point(center), radiusMeters, { units: 'meters' })
  if (!result) {
    throw new Error('Failed to create buffer polygon')
  }
  return result
}

export const createBufferFromGeometry = (
  geometry: Geometry,
  radiusMeters: number,
): Feature<Polygon | MultiPolygon> => {
  const result = buffer(
    { type: 'Feature', geometry, properties: {} },
    radiusMeters,
    { units: 'meters' },
  )
  if (!result) {
    throw new Error('Failed to create buffer polygon')
  }
  return result
}
