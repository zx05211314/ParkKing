import {
  pruneExpiredGeocodeCacheEntries,
  readGeocodeCacheFile,
  writeGeocodeCacheFile,
} from './geocodeProxyCache'
import type {
  GeocodeCacheFile,
  GeocodeProxyConfig,
  GeocodeProxyDependencies,
} from './geocodeProxyTypes'

export interface GeocodeProxyRuntime {
  fetchImpl: typeof fetch
  now: () => number
  ensureCache(): Promise<GeocodeCacheFile>
  persistCache(cache: GeocodeCacheFile): Promise<void>
  pruneExpiredEntries(cache: GeocodeCacheFile): void
}

export const createGeocodeProxyRuntime = (
  config: GeocodeProxyConfig,
  dependencies: GeocodeProxyDependencies = {},
): GeocodeProxyRuntime => {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const now = dependencies.now ?? (() => Date.now())
  let cachePromise: Promise<GeocodeCacheFile> | null = null

  const ensureCache = async () => {
    if (!cachePromise) {
      cachePromise = readGeocodeCacheFile(config.cacheFile)
    }
    return cachePromise
  }

  const pruneExpiredEntries = (cache: GeocodeCacheFile) => {
    pruneExpiredGeocodeCacheEntries(cache, now() - config.cacheTtlMs)
  }

  const persistCache = async (cache: GeocodeCacheFile) => {
    pruneExpiredEntries(cache)
    await writeGeocodeCacheFile(config.cacheFile, cache)
  }

  return {
    fetchImpl,
    now,
    ensureCache,
    persistCache,
    pruneExpiredEntries,
  }
}
