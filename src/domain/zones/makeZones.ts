import type { Feature, FeatureCollection, Geometry, Point } from 'geojson'
import { createBufferFromGeometry, createBufferPolygon } from './buffers'
import {
  BUS_STOP_BUFFER_METERS,
  CROSSWALK_BUFFER_METERS,
  HYDRANT_BUFFER_METERS,
  INTERSECTION_NO_STOP_M,
} from './constants'
import { ZoneType, type Zone } from './zoneTypes'
export {
  BUS_STOP_BUFFER_METERS,
  CROSSWALK_BUFFER_METERS,
  HYDRANT_BUFFER_METERS,
  INTERSECTION_NO_STOP_M,
  ZONE_PARAMS_VERSION,
} from './constants'

const getPointCoord = (feature: Feature<Point>): [number, number] | null => {
  const coords = feature.geometry.coordinates
  if (coords.length < 2) {
    return null
  }
  return [coords[0], coords[1]]
}

const buildZones = (
  features: FeatureCollection<Point>['features'],
  type: ZoneType,
  radiusMeters: number,
  prefix: string,
): Zone[] => {
  return features.flatMap((feature, index) => {
    const coords = getPointCoord(feature)
    if (!coords) {
      return []
    }

    const id = `${prefix}-${index + 1}`
    const name = feature.properties?.name
      ? String(feature.properties.name)
      : `${type} ${index + 1}`

    return [
      {
        id,
        type,
        name,
        center: coords,
        radiusMeters,
        polygon: createBufferPolygon(coords, radiusMeters),
      },
    ]
  })
}

const centerFromGeometry = (geometry: Geometry): [number, number] | null => {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'LineString') {
    const mid = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)]
    return mid ? [mid[0], mid[1]] : null
  }
  if (geometry.type === 'MultiLineString') {
    const line = geometry.coordinates[0]
    if (!line || line.length === 0) {
      return null
    }
    const mid = line[Math.floor(line.length / 2)]
    return mid ? [mid[0], mid[1]] : null
  }
  if (geometry.type === 'Polygon') {
    const coord = geometry.coordinates[0]?.[0]
    return coord ? [coord[0], coord[1]] : null
  }
  if (geometry.type === 'MultiPolygon') {
    const coord = geometry.coordinates[0]?.[0]?.[0]
    return coord ? [coord[0], coord[1]] : null
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const center = centerFromGeometry(child)
      if (center) {
        return center
      }
    }
  }
  return null
}

const buildZonesFromGeometry = (
  features: FeatureCollection['features'],
  type: ZoneType,
  radiusMeters: number,
  prefix: string,
): Zone[] => {
  return features.flatMap((feature, index) => {
    if (!feature.geometry) {
      return []
    }
    const center = centerFromGeometry(feature.geometry)
    if (!center) {
      return []
    }
    const id = `${prefix}-${index + 1}`
    const name = feature.properties?.name
      ? String(feature.properties.name)
      : `${type} ${index + 1}`

    return [
      {
        id,
        type,
        name,
        center,
        radiusMeters,
        polygon: createBufferFromGeometry(feature.geometry, radiusMeters),
      },
    ]
  })
}

export const makeZonesFromPOIs = (
  busStops: FeatureCollection<Point>,
  hydrants: FeatureCollection<Point>,
  intersections: FeatureCollection<Point>,
  crosswalks: FeatureCollection,
): Zone[] => {
  const busZones = buildZones(
    busStops.features,
    ZoneType.BUS_STOP_BUFFER,
    BUS_STOP_BUFFER_METERS,
    'bus',
  )
  const hydrantZones = buildZones(
    hydrants.features,
    ZoneType.HYDRANT_BUFFER,
    HYDRANT_BUFFER_METERS,
    'hydrant',
  )
  const intersectionZones = buildZones(
    intersections.features,
    ZoneType.INTERSECTION_BUFFER,
    INTERSECTION_NO_STOP_M,
    'intersection',
  )
  const crosswalkZones = buildZonesFromGeometry(
    crosswalks.features,
    ZoneType.CROSSWALK_BUFFER,
    CROSSWALK_BUFFER_METERS,
    'crosswalk',
  )

  return [...busZones, ...hydrantZones, ...intersectionZones, ...crosswalkZones]
}
