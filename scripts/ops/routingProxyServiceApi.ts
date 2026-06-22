import {
  buildMatrixCacheKey,
  buildPathCacheKey,
  requestRoutingMatrix,
  requestRoutingPath,
} from './routingProxyTransport'
import type {
  RoutingPathRequest,
  RoutingProxyConfig,
  RoutingProxyRequest,
  RoutingProxyService,
} from './routingProxyTypes'
import type { RoutingProxyRuntime } from './routingProxyRuntime'

export const createRoutingProxyServiceApi = (
  config: RoutingProxyConfig,
  runtime: RoutingProxyRuntime,
): RoutingProxyService => ({
  async route(request: RoutingProxyRequest) {
    if (request.destinations.length === 0) {
      return []
    }

    const cacheKey = buildMatrixCacheKey(request, config)
    const cache = await runtime.ensureCache()
    runtime.pruneExpiredEntries(cache)

    const cached = cache.entries[cacheKey]
    if (cached) {
      return cached.payload as Awaited<ReturnType<typeof requestRoutingMatrix>>
    }

    const payload = await requestRoutingMatrix(
      runtime.providers,
      request,
      runtime.fetchImpl,
      config.userAgent,
      config.requestTimeoutMs,
    )
    cache.entries[cacheKey] = {
      cachedAtMs: runtime.now(),
      payload,
    }
    await runtime.persistCache(cache)
    return payload
  },
  async routePath(request: RoutingPathRequest) {
    const cacheKey = buildPathCacheKey(request, config)
    const cache = await runtime.ensureCache()
    runtime.pruneExpiredEntries(cache)

    const cached = cache.entries[cacheKey]
    if (cached) {
      return cached.payload as Awaited<ReturnType<typeof requestRoutingPath>>
    }

    const payload = await requestRoutingPath(
      runtime.providers,
      request,
      runtime.fetchImpl,
      config.userAgent,
      config.requestTimeoutMs,
    )
    cache.entries[cacheKey] = {
      cachedAtMs: runtime.now(),
      payload,
    }
    await runtime.persistCache(cache)
    return payload
  },
})
