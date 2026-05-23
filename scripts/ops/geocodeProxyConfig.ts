import { resolve } from 'node:path'
import {
  DEFAULT_CACHE_FILE,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_PRIMARY_URL,
  DEFAULT_PROXY_LIMIT,
  DEFAULT_PROXY_PATH,
  DEFAULT_PROXY_PORT,
  DEFAULT_USER_AGENT,
} from './geocodeProxyDefaults'
import {
  normalizeGeocodeText,
  parseCsv,
  parsePositiveInteger,
} from './geocodeProxyParsing'
import type { GeocodeProxyConfig } from './geocodeProxyTypes'

export {
  DEFAULT_CACHE_FILE,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_PRIMARY_URL,
  DEFAULT_PROXY_LIMIT,
  DEFAULT_PROXY_PATH,
  DEFAULT_PROXY_PORT,
  DEFAULT_USER_AGENT,
} from './geocodeProxyDefaults'
export {
  clampLimit,
  normalizeGeocodeText,
  parseCsv,
  parsePositiveInteger,
} from './geocodeProxyParsing'

export const resolveGeocodeProxyConfig = (
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): GeocodeProxyConfig => {
  const primaryEndpoint =
    normalizeGeocodeText(env.PARKKING_GEOCODER_PRIMARY_URL) ?? DEFAULT_PRIMARY_URL
  const fallbackEndpoint = normalizeGeocodeText(env.PARKKING_GEOCODER_FALLBACK_URL)

  return {
    primary: {
      endpoint: primaryEndpoint,
      countryCodes: parseCsv(env.PARKKING_GEOCODER_COUNTRY_CODES),
    },
    fallback:
      fallbackEndpoint && fallbackEndpoint !== primaryEndpoint
        ? {
            endpoint: fallbackEndpoint,
            countryCodes: parseCsv(env.PARKKING_GEOCODER_COUNTRY_CODES),
          }
        : null,
    limit: parsePositiveInteger(env.PARKKING_GEOCODER_LIMIT, DEFAULT_PROXY_LIMIT),
    cacheTtlMs: parsePositiveInteger(
      env.PARKKING_GEOCODER_CACHE_TTL_MS,
      DEFAULT_CACHE_TTL_MS,
    ),
    cacheFile: resolve(cwd, env.PARKKING_GEOCODER_CACHE_FILE ?? DEFAULT_CACHE_FILE),
    userAgent: normalizeGeocodeText(env.PARKKING_GEOCODER_USER_AGENT) ?? DEFAULT_USER_AGENT,
    path: normalizeGeocodeText(env.PARKKING_GEOCODER_PATH) ?? DEFAULT_PROXY_PATH,
    port: parsePositiveInteger(env.PARKKING_GEOCODER_PORT, DEFAULT_PROXY_PORT),
  }
}
