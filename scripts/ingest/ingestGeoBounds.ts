import type { FeatureCollection, Geometry } from 'geojson'

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const collectCoords = (coords: unknown, result: [number, number][]) => {
  if (!Array.isArray(coords)) {
    return
  }

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    result.push([coords[0], coords[1]])
    return
  }

  coords.forEach((entry) => collectCoords(entry, result))
}

const collectGeometryCoords = (geometry: Geometry, result: [number, number][]) => {
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries.forEach((entry) => collectGeometryCoords(entry, result))
    return
  }

  collectCoords((geometry as Geometry & { coordinates?: unknown }).coordinates, result)
}

const bboxFromGeometry = (geometry: Geometry): BBox | null => {
  const coords: [number, number][] = []
  collectGeometryCoords(geometry, coords)

  if (coords.length === 0) {
    return null
  }

  const xs = coords.map((coord) => coord[0])
  const ys = coords.map((coord) => coord[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

const mergeBBoxes = (left: BBox | null, right: BBox | null): BBox | null => {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  }
}

export const bboxFromCollection = (collection: FeatureCollection): BBox | null => {
  return collection.features.reduce<BBox | null>((current, feature) => {
    if (!feature.geometry) {
      return current
    }
    return mergeBBoxes(current, bboxFromGeometry(feature.geometry))
  }, null)
}

export const centerFromBBox = (bbox: BBox | null): [number, number] | null => {
  if (!bbox) {
    return null
  }
  return [(bbox.minX + bbox.maxX) / 2, (bbox.minY + bbox.maxY) / 2]
}
