import type { Geometry } from 'geojson'

const collectCoordinateNumbers = (coords: unknown, result: number[]) => {
  if (Array.isArray(coords)) {
    coords.forEach((value) => collectCoordinateNumbers(value, result))
    return
  }
  if (typeof coords === 'number') {
    result.push(coords)
  }
}

export const hasValidCoordinates = (geometry: Geometry | null) => {
  if (!geometry) {
    return false
  }
  if (geometry.type === 'GeometryCollection') {
    if (geometry.geometries.length === 0) {
      return false
    }
    return geometry.geometries.every((child) => hasValidCoordinates(child))
  }
  const values: number[] = []
  collectCoordinateNumbers((geometry as Geometry & { coordinates?: unknown }).coordinates, values)
  if (values.length < 2 || values.length % 2 !== 0) {
    return false
  }
  return values.every((value) => Number.isFinite(value))
}
