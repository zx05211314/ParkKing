export type FetchLike = typeof fetch

export interface GeocodeProxyProviderConfig {
  endpoint: string
  countryCodes: string[]
}

export interface GeocodeProxyConfig {
  primary: GeocodeProxyProviderConfig
  fallback: GeocodeProxyProviderConfig | null
  limit: number
  cacheTtlMs: number
  requestTimeoutMs: number
  cacheFile: string
  userAgent: string
  path: string
  port: number
}

export interface GeocodeProxyRequest {
  query: string
  viewbox?: string | null
  bounded?: boolean
  limit?: number
}

export interface GeocodeProxyAttempt {
  provider: GeocodeProxyProviderConfig
  viewbox: string | null
  bounded: boolean
}

export interface GeocodeCacheEntry {
  cachedAtMs: number
  payload: unknown[]
}

export interface GeocodeCacheFile {
  entries: Record<string, GeocodeCacheEntry>
}

export interface GeocodeProxyDependencies {
  fetchImpl?: FetchLike
  now?: () => number
}

export interface GeocodeProxyService {
  search(request: GeocodeProxyRequest): Promise<unknown[]>
}
