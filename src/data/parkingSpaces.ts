import type {
  GeoJsonProperties,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson'
import RBush from 'rbush'
import type { BBox } from 'rbush'
import {
  distanceMeters,
  getPathMidpoint,
  pointToPathDistanceMeters,
} from '../map/geoMath'
import type { Segment } from '../ui/types'

export type ParkingSpaceGeometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon

export type ParkingSpaceProperties = GeoJsonProperties
export type ParkingSpaceCollection = FeatureCollection<
  ParkingSpaceGeometry,
  ParkingSpaceProperties
>

export interface ParkingSpaceMatch {
  key: string
  anchor: [number, number]
  distanceToSegmentMeters: number
  distanceToReferenceMeters: number
  properties: ParkingSpaceProperties
}

interface ParkingSpaceAnchorMatch {
  anchor: [number, number]
  distanceToSegmentMeters: number
  properties: ParkingSpaceProperties
}

interface ParkingSpaceIndexEntry extends BBox {
  anchor: [number, number]
  properties: ParkingSpaceProperties
}

const getAveragePoint = (coordinates: [number, number][]) => {
  if (coordinates.length === 0) {
    return null
  }
  const total = coordinates.reduce(
    (acc, [lng, lat]) => {
      acc[0] += lng
      acc[1] += lat
      return acc
    },
    [0, 0],
  )
  return [
    total[0] / coordinates.length,
    total[1] / coordinates.length,
  ] as [number, number]
}

export const getParkingSpaceAnchor = (
  geometry: Geometry | null,
): [number, number] | null => {
  if (!geometry) {
    return null
  }

  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'MultiPoint') {
    return getAveragePoint(
      geometry.coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]),
    )
  }
  if (geometry.type === 'LineString') {
    return getAveragePoint(
      geometry.coordinates.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]),
    )
  }
  if (geometry.type === 'MultiLineString') {
    return getAveragePoint(
      geometry.coordinates.flatMap((line) =>
        line.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]),
      ),
    )
  }
  if (geometry.type === 'Polygon') {
    return getAveragePoint(
      geometry.coordinates.flatMap((ring) =>
        ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]),
      ),
    )
  }
  if (geometry.type === 'MultiPolygon') {
    return getAveragePoint(
      geometry.coordinates.flatMap((polygon) =>
        polygon.flatMap((ring) =>
          ring.map((coordinate) => [coordinate[0], coordinate[1]] as [number, number]),
        ),
      ),
    )
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const anchor = getParkingSpaceAnchor(child)
      if (anchor) {
        return anchor
      }
    }
  }
  return null
}

const buildParkingSpaceIndexEntries = (
  parkingSpaces: ParkingSpaceCollection,
): ParkingSpaceIndexEntry[] => {
  return parkingSpaces.features.reduce<ParkingSpaceIndexEntry[]>((entries, feature) => {
    const anchor = getParkingSpaceAnchor(feature.geometry)
    if (!anchor) {
      return entries
    }
    entries.push({
      minX: anchor[0],
      minY: anchor[1],
      maxX: anchor[0],
      maxY: anchor[1],
      anchor,
      properties: feature.properties ?? null,
    })
    return entries
  }, [])
}

const buildParkingSpaceIndex = (entries: ParkingSpaceIndexEntry[]) => {
  const tree = new RBush<ParkingSpaceIndexEntry>()
  if (entries.length > 0) {
    tree.load(entries)
  }
  return tree
}

const parkingSpaceIndexCache = new WeakMap<
  ParkingSpaceCollection,
  RBush<ParkingSpaceIndexEntry>
>()

const getParkingSpaceIndex = (parkingSpaces: ParkingSpaceCollection) => {
  const cached = parkingSpaceIndexCache.get(parkingSpaces)
  if (cached) {
    return cached
  }

  const index = buildParkingSpaceIndex(buildParkingSpaceIndexEntries(parkingSpaces))
  parkingSpaceIndexCache.set(parkingSpaces, index)
  return index
}

const getPathSearchBounds = (
  path: [number, number][],
  matchToleranceMeters: number,
): BBox => {
  const reference = getPathMidpoint(path)
  const latDelta = matchToleranceMeters / 110_540
  const cosLat = Math.cos((reference[1] * Math.PI) / 180)
  const safeCosLat = Math.max(Math.abs(cosLat), 0.1)
  const lngDelta = matchToleranceMeters / (111_320 * safeCosLat)

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  path.forEach(([lng, lat]) => {
    minX = Math.min(minX, lng)
    minY = Math.min(minY, lat)
    maxX = Math.max(maxX, lng)
    maxY = Math.max(maxY, lat)
  })

  return {
    minX: minX - lngDelta,
    minY: minY - latDelta,
    maxX: maxX + lngDelta,
    maxY: maxY + latDelta,
  }
}

const getParkingSpaceAnchorMatchesFromIndex = (
  path: [number, number][],
  index: RBush<ParkingSpaceIndexEntry>,
  matchToleranceMeters = 12,
) => {
  if (path.length === 0) {
    return [] satisfies ParkingSpaceAnchorMatch[]
  }

  const candidates = index.search(getPathSearchBounds(path, matchToleranceMeters))
  return candidates.reduce<ParkingSpaceAnchorMatch[]>((matches, entry) => {
    const distanceToSegmentMeters = pointToPathDistanceMeters(entry.anchor, path)
    if (distanceToSegmentMeters > matchToleranceMeters) {
      return matches
    }

    matches.push({
      anchor: entry.anchor,
      distanceToSegmentMeters,
      properties: entry.properties,
    })
    return matches
  }, [])
}

const getParkingSpaceMatchKey = (
  anchor: [number, number],
  distanceToSegmentMeters: number,
) => `${anchor[0].toFixed(7)},${anchor[1].toFixed(7)}:${distanceToSegmentMeters.toFixed(2)}`

export const getParkingSpaceMatches = (
  path: [number, number][],
  parkingSpaces: ParkingSpaceCollection,
  origin: [number, number] | null = null,
  matchToleranceMeters = 12,
) => {
  if (path.length === 0) {
    return [] satisfies ParkingSpaceMatch[]
  }

  const referencePoint = origin ?? getPathMidpoint(path)
  const index = getParkingSpaceIndex(parkingSpaces)
  return getParkingSpaceAnchorMatchesFromIndex(path, index, matchToleranceMeters)
    .map((match) => ({
      key: getParkingSpaceMatchKey(match.anchor, match.distanceToSegmentMeters),
      anchor: match.anchor,
      distanceToSegmentMeters: match.distanceToSegmentMeters,
      distanceToReferenceMeters: distanceMeters(referencePoint, match.anchor),
      properties: match.properties,
    }))
    .sort((left, right) => {
      if (left.distanceToReferenceMeters !== right.distanceToReferenceMeters) {
        return left.distanceToReferenceMeters - right.distanceToReferenceMeters
      }
      if (left.distanceToSegmentMeters !== right.distanceToSegmentMeters) {
        return left.distanceToSegmentMeters - right.distanceToSegmentMeters
      }
      if (left.anchor[0] !== right.anchor[0]) {
        return left.anchor[0] - right.anchor[0]
      }
      return left.anchor[1] - right.anchor[1]
    })
}

const getStringProperty = (
  properties: ParkingSpaceProperties,
  patterns: RegExp[],
) => {
  if (!properties) {
    return null
  }

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) {
      continue
    }
    if (!patterns.some((pattern) => pattern.test(key))) {
      continue
    }
    const text = String(value).trim()
    if (text.length > 0) {
      return text
    }
  }
  return null
}

export const getParkingSpaceLabel = (
  properties: ParkingSpaceProperties,
  fallbackLabel: string,
) => {
  return (
    getStringProperty(properties, [/^name$/i, /^label$/i, /stall/i, /space/i, /^id$/i]) ??
    fallbackLabel
  )
}

export const getParkingSpaceMetadata = (properties: ParkingSpaceProperties) => {
  const metadata = [
    getStringProperty(properties, [/status/i]),
    getStringProperty(properties, [/type/i, /kind/i, /class/i]),
    getStringProperty(properties, [/fee/i, /rate/i, /pay/i]),
  ].filter((value): value is string => Boolean(value))

  return metadata
}

export const getPreferredParkingSpaceAnchor = (
  path: [number, number][],
  parkingSpaces: ParkingSpaceCollection,
  origin: [number, number] | null = null,
  matchToleranceMeters = 12,
) => {
  return getParkingSpaceMatches(path, parkingSpaces, origin, matchToleranceMeters)[0]?.anchor ?? null
}

export const countParkingSpacesNearSegments = <T extends Segment>(
  segments: T[],
  parkingSpaces: ParkingSpaceCollection,
  matchToleranceMeters = 12,
) => {
  if (parkingSpaces.features.length === 0) {
    return segments.map((segment) => ({
      ...segment,
      parkingSpaceCount: 0,
    }))
  }

  const index = getParkingSpaceIndex(parkingSpaces)
  return segments.map((segment) => {
    const parkingSpaceCount = getParkingSpaceAnchorMatchesFromIndex(
      segment.path,
      index,
      matchToleranceMeters,
    ).length

    return {
      ...segment,
      parkingSpaceCount,
    }
  })
}
