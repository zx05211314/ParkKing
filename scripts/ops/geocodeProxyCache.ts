import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { GeocodeCacheFile } from './geocodeProxyTypes'

export const readGeocodeCacheFile = async (
  cacheFile: string,
): Promise<GeocodeCacheFile> => {
  try {
    const raw = await readFile(cacheFile, 'utf8')
    const parsed = JSON.parse(raw) as GeocodeCacheFile
    return {
      entries: parsed.entries ?? {},
    }
  } catch {
    return { entries: {} }
  }
}

export const writeGeocodeCacheFile = async (
  cacheFile: string,
  payload: GeocodeCacheFile,
) => {
  await mkdir(dirname(cacheFile), { recursive: true })
  await writeFile(cacheFile, JSON.stringify(payload, null, 2), 'utf8')
}

export const pruneExpiredGeocodeCacheEntries = (
  cache: GeocodeCacheFile,
  thresholdMs: number,
) => {
  Object.entries(cache.entries).forEach(([key, entry]) => {
    if (entry.cachedAtMs < thresholdMs) {
      delete cache.entries[key]
    }
  })
}
