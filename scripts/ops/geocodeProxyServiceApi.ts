import { buildGeocodeAttempts } from './geocodeProxyAttempts'
import { clampLimit } from './geocodeProxyParsing'
import { buildGeocodeCacheKey } from './geocodeProxyRequestKeys'
import { requestGeocodeResults } from './geocodeProxyTransport'
import type {
  GeocodeProxyConfig,
  GeocodeProxyRequest,
  GeocodeProxyService,
} from './geocodeProxyTypes'
import type { GeocodeProxyRuntime } from './geocodeProxyRuntime'

export const createGeocodeProxyServiceApi = (
  config: GeocodeProxyConfig,
  runtime: GeocodeProxyRuntime,
): GeocodeProxyService => ({
  async search(request: GeocodeProxyRequest): Promise<unknown[]> {
    const query = request.query.trim()
    if (!query) {
      return []
    }

    const effectiveLimit = clampLimit(request.limit, config.limit)
    const normalizedRequest = { ...request, query }
    const cacheKey = buildGeocodeCacheKey(normalizedRequest, config, effectiveLimit)
    const cache = await runtime.ensureCache()
    runtime.pruneExpiredEntries(cache)

    const cached = cache.entries[cacheKey]
    if (cached) {
      return cached.payload
    }

    const { results, sawSuccessfulResponse } = await requestGeocodeResults(
      buildGeocodeAttempts(config, normalizedRequest),
      normalizedRequest,
      config,
      runtime.fetchImpl,
    )
    if (results.length > 0 || sawSuccessfulResponse) {
      cache.entries[cacheKey] = {
        cachedAtMs: runtime.now(),
        payload: results,
      }
      await runtime.persistCache(cache)
    }
    return results
  },
})
