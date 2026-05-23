import type { GeocodeProxyConfig } from './geocodeProxyTypes'

export interface GeocodeProxyHealthResponse {
  schemaVersion: 1
  service: 'geocode-proxy'
  status: 'ok' | 'degraded'
  searchPath: string
  healthPath: string
  readinessPath: string
  primaryEndpoint: string | null
  fallbackEndpoint: string | null
  countryCodes: string[]
  limit: number | null
  cacheFile: string | null
  cacheTtlMs: number | null
  issues: string[]
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, '')

export const joinGeocodeProxyPath = (basePath: string, suffix: string) =>
  `${trimTrailingSlash(basePath)}/${suffix.replace(/^\/+/g, '')}`

const isValidHttpUrl = (value: string | null | undefined) => {
  if (!value) {
    return false
  }
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const buildGeocodeProxyReadinessIssues = (
  config: GeocodeProxyConfig | null,
) => {
  if (!config) {
    return ['geocode proxy config unavailable']
  }

  const issues: string[] = []
  if (!isValidHttpUrl(config.primary.endpoint)) {
    issues.push('primary endpoint is not a valid http(s) URL')
  }
  if (config.fallback && !isValidHttpUrl(config.fallback.endpoint)) {
    issues.push('fallback endpoint is not a valid http(s) URL')
  }
  if (!Number.isFinite(config.limit) || config.limit <= 0) {
    issues.push('limit must be positive')
  }
  if (!Number.isFinite(config.cacheTtlMs) || config.cacheTtlMs <= 0) {
    issues.push('cache TTL must be positive')
  }
  if (!config.cacheFile.trim()) {
    issues.push('cache file is empty')
  }
  return issues
}

export const buildGeocodeProxyHealth = (
  pathname: string,
  config: GeocodeProxyConfig | null = null,
  issues: string[] = [],
): GeocodeProxyHealthResponse => ({
  schemaVersion: 1,
  service: 'geocode-proxy',
  status: issues.length === 0 ? 'ok' : 'degraded',
  searchPath: trimTrailingSlash(pathname),
  healthPath: joinGeocodeProxyPath(pathname, 'health'),
  readinessPath: joinGeocodeProxyPath(pathname, 'ready'),
  primaryEndpoint: config?.primary.endpoint ?? null,
  fallbackEndpoint: config?.fallback?.endpoint ?? null,
  countryCodes: config?.primary.countryCodes ?? [],
  limit: config?.limit ?? null,
  cacheFile: config?.cacheFile ?? null,
  cacheTtlMs: config?.cacheTtlMs ?? null,
  issues,
})
