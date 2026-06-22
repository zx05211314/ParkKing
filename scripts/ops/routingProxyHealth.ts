import type { RoutingProxyConfig } from './routingProxyTypes'

export interface RoutingProxyHealthResponse {
  schemaVersion: 1
  service: 'routing-proxy'
  status: 'ok' | 'degraded'
  routePath: string
  healthPath: string
  readinessPath: string
  primaryEndpoint: string | null
  fallbackEndpoint: string | null
  cacheFile: string | null
  cacheTtlMs: number | null
  requestTimeoutMs: number | null
  issues: string[]
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, '')

export const joinRoutingProxyPath = (basePath: string, suffix: string) =>
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

export const buildRoutingProxyReadinessIssues = (
  config: RoutingProxyConfig | null,
) => {
  if (!config) {
    return ['routing proxy config unavailable']
  }

  const issues: string[] = []
  if (!isValidHttpUrl(config.primary.endpoint)) {
    issues.push('primary endpoint is not a valid http(s) URL')
  }
  if (config.fallback && !isValidHttpUrl(config.fallback.endpoint)) {
    issues.push('fallback endpoint is not a valid http(s) URL')
  }
  if (!Number.isFinite(config.cacheTtlMs) || config.cacheTtlMs <= 0) {
    issues.push('cache TTL must be positive')
  }
  if (!Number.isFinite(config.requestTimeoutMs) || config.requestTimeoutMs <= 0) {
    issues.push('request timeout must be positive')
  }
  if (!config.cacheFile.trim()) {
    issues.push('cache file is empty')
  }
  return issues
}

export const buildRoutingProxyHealth = (
  pathname: string,
  config: RoutingProxyConfig | null = null,
  issues: string[] = [],
): RoutingProxyHealthResponse => ({
  schemaVersion: 1,
  service: 'routing-proxy',
  status: issues.length === 0 ? 'ok' : 'degraded',
  routePath: trimTrailingSlash(pathname),
  healthPath: joinRoutingProxyPath(pathname, 'health'),
  readinessPath: joinRoutingProxyPath(pathname, 'ready'),
  primaryEndpoint: config?.primary.endpoint ?? null,
  fallbackEndpoint: config?.fallback?.endpoint ?? null,
  cacheFile: config?.cacheFile ?? null,
  cacheTtlMs: config?.cacheTtlMs ?? null,
  requestTimeoutMs: config?.requestTimeoutMs ?? null,
  issues,
})
