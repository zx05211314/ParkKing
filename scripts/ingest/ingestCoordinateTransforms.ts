import proj4 from 'proj4'
import type { FeatureCollection, Geometry } from 'geojson'
import { EPSG_3826, EPSG_4326 } from './ingestCrs'

export const detectCrsFromPrj = (prj: string | null, fallback: string): string => {
  if (!prj) {
    return fallback
  }

  const normalized = prj.toLowerCase()
  if (normalized.includes('wgs_1984') || normalized.includes('wgs 84')) {
    return EPSG_4326
  }
  if (normalized.includes('twd97') || normalized.includes('twd_1997')) {
    return EPSG_3826
  }

  return fallback
}

export const transformCoord = (coord: number[], from: string): [number, number] => {
  if (from === EPSG_4326) {
    return [coord[0], coord[1]]
  }
  const [x, y] = proj4(from, EPSG_4326, coord)
  return [x, y]
}

export const transformGeometry = (geometry: Geometry, from: string): Geometry => {
  switch (geometry.type) {
    case 'Point':
      return {
        ...geometry,
        coordinates: transformCoord(geometry.coordinates, from),
      }
    case 'MultiPoint':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((coord) => transformCoord(coord, from)),
      }
    case 'LineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((coord) => transformCoord(coord, from)),
      }
    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((line) =>
          line.map((coord) => transformCoord(coord, from)),
        ),
      }
    case 'Polygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) =>
          ring.map((coord) => transformCoord(coord, from)),
        ),
      }
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) =>
          polygon.map((ring) => ring.map((coord) => transformCoord(coord, from))),
        ),
      }
    case 'GeometryCollection':
      return {
        ...geometry,
        geometries: geometry.geometries.map((entry) => transformGeometry(entry, from)),
      }
    default:
      return geometry
  }
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

const sampleCoordFromGeometry = (geometry: Geometry): [number, number] | null => {
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const sample = sampleCoordFromGeometry(child)
      if (sample) {
        return sample
      }
    }
    return null
  }

  const coords: [number, number][] = []
  collectCoords((geometry as Geometry & { coordinates?: unknown }).coordinates ?? null, coords)
  return coords[0] ?? null
}

export const normalizeFeatures = (
  collection: FeatureCollection,
  sourceCrs: string,
): FeatureCollection => {
  if (sourceCrs === EPSG_4326) {
    return collection
  }

  return {
    ...collection,
    features: collection.features.map((feature) =>
      feature.geometry
        ? {
            ...feature,
            geometry: transformGeometry(feature.geometry, sourceCrs),
          }
        : feature,
    ),
  }
}

export const sampleCoordFromCollection = (
  collection: FeatureCollection,
): [number, number] | null => {
  for (const feature of collection.features) {
    if (!feature.geometry) {
      continue
    }
    const sample = sampleCoordFromGeometry(feature.geometry)
    if (sample) {
      return sample
    }
  }
  return null
}

export const isLikelyLngLat = (coord: [number, number] | null) => {
  if (!coord) {
    return false
  }
  return Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90
}

export const shouldTransformGeometry = (geometry: Geometry) => {
  const coord = sampleCoordFromGeometry(geometry)
  if (!coord) {
    return false
  }
  return Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90
}
