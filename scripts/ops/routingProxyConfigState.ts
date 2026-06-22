import {
  DEFAULT_CACHE_FILE,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_PRIMARY_URL,
  DEFAULT_PROXY_PATH,
  DEFAULT_PROXY_PORT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
} from './routingProxyDefaults'
import {
  normalizeRoutingText,
  parsePositiveInteger,
} from './routingProxyParsing'
import type { RoutingProxyConfig } from './routingProxyTypes'
import { resolveCompat } from './pathCompat'

export const resolveRoutingProxyConfig = (
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): RoutingProxyConfig => {
  const primaryEndpoint =
    normalizeRoutingText(env.PARKKING_ROUTING_PRIMARY_URL) ?? DEFAULT_PRIMARY_URL
  const fallbackEndpoint = normalizeRoutingText(env.PARKKING_ROUTING_FALLBACK_URL)

  return {
    primary: {
      endpoint: primaryEndpoint,
    },
    fallback:
      fallbackEndpoint && fallbackEndpoint !== primaryEndpoint
        ? {
            endpoint: fallbackEndpoint,
          }
        : null,
    cacheTtlMs: parsePositiveInteger(
      env.PARKKING_ROUTING_CACHE_TTL_MS,
      DEFAULT_CACHE_TTL_MS,
    ),
    requestTimeoutMs: parsePositiveInteger(
      env.PARKKING_ROUTING_REQUEST_TIMEOUT_MS,
      DEFAULT_REQUEST_TIMEOUT_MS,
    ),
    cacheFile: resolveCompat(cwd, env.PARKKING_ROUTING_CACHE_FILE ?? DEFAULT_CACHE_FILE),
    userAgent: normalizeRoutingText(env.PARKKING_ROUTING_USER_AGENT) ?? DEFAULT_USER_AGENT,
    path: normalizeRoutingText(env.PARKKING_ROUTING_PATH) ?? DEFAULT_PROXY_PATH,
    port: parsePositiveInteger(env.PARKKING_ROUTING_PORT, DEFAULT_PROXY_PORT),
  }
}
