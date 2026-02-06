import RBush from 'rbush'
import type { Geometry, MultiPolygon, Polygon } from 'geojson'
import type { Zone } from './zoneTypes'

export interface ZoneIndexItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
}

export interface ZoneIndex {
  index: RBush<ZoneIndexItem>
  zonesById: Map<string, Zone>
  datasetHash: string
  paramsVersion: string
}

const zoneIndexCache = new Map<string, ZoneIndex>()

const buildCacheKey = (datasetHash: string, paramsVersion: string) =>
  `${datasetHash}::${paramsVersion}`

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
    geometry.geometries.forEach((child) => collectGeometryCoords(child, result))
    return
  }

  collectCoords(geometry.coordinates, result)
}

const bboxFromGeometry = (geometry: Geometry) => {
  const coords: [number, number][] = []
  collectGeometryCoords(geometry, coords)

  if (coords.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

const bboxFromLine = (line: [number, number][]) => {
  if (line.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  const xs = line.map((coord) => coord[0])
  const ys = line.map((coord) => coord[1])
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

export const buildZoneIndex = (
  zones: Zone[],
  datasetHash: string,
  paramsVersion: string,
): ZoneIndex => {
  const index = new RBush<ZoneIndexItem>()
  const zonesById = new Map<string, Zone>()

  const items: ZoneIndexItem[] = zones.map((zone) => {
    zonesById.set(zone.id, zone)
    const geometry = zone.polygon.geometry as Polygon | MultiPolygon
    const bbox = bboxFromGeometry(geometry)
    return { ...bbox, id: zone.id }
  })

  if (items.length > 0) {
    index.load(items)
  }

  return { index, zonesById, datasetHash, paramsVersion }
}

export const getZoneIndex = (
  zones: Zone[],
  datasetHash: string,
  paramsVersion: string,
): ZoneIndex => {
  const cacheKey = buildCacheKey(datasetHash, paramsVersion)
  const cached = zoneIndexCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const built = buildZoneIndex(zones, datasetHash, paramsVersion)
  zoneIndexCache.set(cacheKey, built)
  return built
}

export const queryZonesForLine = (
  line: [number, number][],
  zoneIndex: ZoneIndex,
): Zone[] => {
  if (line.length < 2) {
    return []
  }

  const bbox = bboxFromLine(line)
  const results = zoneIndex.index.search(bbox)
  return results
    .map((item: ZoneIndexItem) => zoneIndex.zonesById.get(item.id))
    .filter((zone): zone is Zone => Boolean(zone))
}

export const clearZoneIndexCache = (
  datasetHash?: string,
  paramsVersion?: string,
) => {
  if (!datasetHash && !paramsVersion) {
    zoneIndexCache.clear()
    return
  }

  for (const key of zoneIndexCache.keys()) {
    const [hash, version] = key.split('::')
    if (datasetHash && hash !== datasetHash) {
      continue
    }
    if (paramsVersion && version !== paramsVersion) {
      continue
    }
    zoneIndexCache.delete(key)
  }
}
