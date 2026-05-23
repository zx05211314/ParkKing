import {
  pruneExpiredRoutingCacheEntries,
  readRoutingCacheFile,
  writeRoutingCacheFile,
} from './routingProxyCache'
import type {
  RoutingCacheFile,
  RoutingProxyConfig,
  RoutingProxyDependencies,
  RoutingProxyProviderConfig,
} from './routingProxyTypes'

export interface RoutingProxyRuntime {
  fetchImpl: typeof fetch
  now(): number
  providers: RoutingProxyProviderConfig[]
  ensureCache(): Promise<RoutingCacheFile>
  pruneExpiredEntries(cache: RoutingCacheFile): void
  persistCache(cache: RoutingCacheFile): Promise<void>
}

const resolveRoutingProviders = (config: RoutingProxyConfig) => {
  return [config.primary, config.fallback].filter(
    (provider): provider is RoutingProxyProviderConfig => provider !== null,
  )
}

export const createRoutingProxyRuntime = (
  config: RoutingProxyConfig,
  dependencies: RoutingProxyDependencies = {},
): RoutingProxyRuntime => {
  const fetchImpl = dependencies.fetchImpl ?? fetch
  const now = dependencies.now ?? (() => Date.now())
  const providers = resolveRoutingProviders(config)
  let cachePromise: Promise<RoutingCacheFile> | null = null

  const ensureCache = async () => {
    if (!cachePromise) {
      cachePromise = readRoutingCacheFile(config.cacheFile)
    }
    return cachePromise
  }

  const pruneExpiredEntries = (cache: RoutingCacheFile) => {
    pruneExpiredRoutingCacheEntries(cache, now() - config.cacheTtlMs)
  }

  const persistCache = async (cache: RoutingCacheFile) => {
    pruneExpiredEntries(cache)
    await writeRoutingCacheFile(config.cacheFile, cache)
  }

  return {
    fetchImpl,
    now,
    providers,
    ensureCache,
    pruneExpiredEntries,
    persistCache,
  }
}
