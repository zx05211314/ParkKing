import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { ClippedLine } from './clipLineByPolygons'
import { clipLineByPolygons } from './clipLineByPolygons'

export interface ClipCacheStats {
  hits: number
  misses: number
  size: number
  maxEntries: number
}

const DEFAULT_MAX_ENTRIES = 5000

const clipCache = new Map<string, ClippedLine[]>()
let maxEntries = DEFAULT_MAX_ENTRIES
let hits = 0
let misses = 0

const buildKey = (
  datasetHash: string,
  segmentId: string,
  zoneParamsVersion: string,
) => `${datasetHash}::${zoneParamsVersion}::${segmentId}`

const touch = (key: string, value: ClippedLine[]) => {
  clipCache.delete(key)
  clipCache.set(key, value)
}

const enforceLimit = () => {
  while (clipCache.size > maxEntries) {
    const oldestKey = clipCache.keys().next().value
    if (!oldestKey) {
      return
    }
    clipCache.delete(oldestKey)
  }
}

export const getClippedLines = (
  datasetHash: string,
  segmentId: string,
  zoneParamsVersion: string,
  line: [number, number][],
  polygons: Array<Feature<Polygon | MultiPolygon>>,
): ClippedLine[] => {
  const key = buildKey(datasetHash, segmentId, zoneParamsVersion)
  const cached = clipCache.get(key)
  if (cached) {
    hits += 1
    touch(key, cached)
    return cached
  }

  misses += 1
  const clipped = polygons.length > 0
    ? clipLineByPolygons(line, polygons)
    : [{ line, insideAnyPolygon: false }]

  clipCache.set(key, clipped)
  enforceLimit()
  return clipped
}

export const setClipCacheMaxEntries = (nextMax: number) => {
  if (!Number.isFinite(nextMax)) {
    return
  }
  maxEntries = Math.max(1, Math.floor(nextMax))
  enforceLimit()
}

export const getClipCacheStats = (): ClipCacheStats => ({
  hits,
  misses,
  size: clipCache.size,
  maxEntries,
})

export const resetClipCacheStats = () => {
  hits = 0
  misses = 0
}

export const clearClipCache = (
  datasetHash?: string,
  zoneParamsVersion?: string,
) => {
  if (!datasetHash && !zoneParamsVersion) {
    clipCache.clear()
    resetClipCacheStats()
    return
  }

  for (const key of clipCache.keys()) {
    const [hash, paramsVersion] = key.split('::')
    if (datasetHash && hash !== datasetHash) {
      continue
    }
    if (zoneParamsVersion && paramsVersion !== zoneParamsVersion) {
      continue
    }
    clipCache.delete(key)
  }
}
