import type { MapBounds } from './bounds'
import { expandBounds } from './bounds'
import {
  createEndpointUrl,
  fetchJson,
  normalizeOptionalText,
  readViteEnv,
  resolveLocalhostProxyEndpoint,
  type ViteEnvLike,
} from '../api/client'
import { checkServiceReadiness } from '../api/serviceReadiness'

const DEFAULT_GEOCODER_URL = 'https://nominatim.openstreetmap.org/search'
const DEFAULT_GEOCODER_LIMIT = 5
const LOCAL_PROXY_PATH = '/api/geocode'
export const GEOCODER_SERVICE_UNAVAILABLE_MESSAGE =
  'Address search service is unavailable. Search is disabled until /api/geocode or VITE_GEOCODER_URL is available.'
export const GEOCODER_SERVICE_DEGRADED_MESSAGE =
  'Address search service is degraded'

export interface GeocoderProviderConfig {
  endpoint: string
  countryCodes: string[]
}

export interface GeocoderConfig {
  primary: GeocoderProviderConfig
  fallback: GeocoderProviderConfig | null
  limit: number
}

export interface GeocodeResult {
  id: string
  label: string
  center: [number, number]
  bounds: MapBounds | null
}

interface NominatimResult {
  place_id?: string | number
  display_name?: string
  lat?: string
  lon?: string
  boundingbox?: string[]
}

interface SearchAddressesOptions {
  biasBounds?: MapBounds | null
  config?: GeocoderConfig
  fetchImpl?: typeof fetch
}

interface BuildGeocoderUrlOptions {
  biasBounds?: MapBounds | null
  bounded?: boolean
}

interface GeocoderAttempt {
  provider: GeocoderProviderConfig
  biasBounds: MapBounds | null
  bounded: boolean
}

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseCsv = (value: string | undefined) => {
  if (!value) {
    return []
  }
  return value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

const parseNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const boundsFromNominatim = (value?: string[]): MapBounds | null => {
  if (!value || value.length < 4) {
    return null
  }

  const south = parseNumber(value[0])
  const north = parseNumber(value[1])
  const west = parseNumber(value[2])
  const east = parseNumber(value[3])
  if (south === null || north === null || west === null || east === null) {
    return null
  }

  return expandBounds(
    [
      [west, south],
      [east, north],
    ],
    0.0008,
  )
}

export const resolveGeocoderConfig = (
  env: ViteEnvLike = readViteEnv(),
): GeocoderConfig => {
  const countryCodes = parseCsv(env.VITE_GEOCODER_COUNTRY_CODES)
  const primaryEndpoint =
    normalizeOptionalText(env.VITE_GEOCODER_URL) ??
    resolveLocalhostProxyEndpoint(LOCAL_PROXY_PATH) ??
    DEFAULT_GEOCODER_URL
  const fallbackEndpoint = normalizeOptionalText(env.VITE_GEOCODER_FALLBACK_URL)

  return {
    primary: {
      endpoint: primaryEndpoint,
      countryCodes,
    },
    fallback:
      fallbackEndpoint && fallbackEndpoint !== primaryEndpoint
        ? {
            endpoint: fallbackEndpoint,
            countryCodes,
          }
        : null,
    limit: parsePositiveInteger(env.VITE_GEOCODER_LIMIT, DEFAULT_GEOCODER_LIMIT),
  }
}

export const buildGeocoderUrl = (
  query: string,
  provider: GeocoderProviderConfig = resolveGeocoderConfig().primary,
  limit = resolveGeocoderConfig().limit,
  options: BuildGeocoderUrlOptions = {},
) => {
  const url = createEndpointUrl(provider.endpoint)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(limit))

  if (provider.countryCodes.length > 0) {
    url.searchParams.set('countrycodes', provider.countryCodes.join(','))
  }

  if (options.biasBounds) {
    const [[west, south], [east, north]] = options.biasBounds
    url.searchParams.set('viewbox', `${west},${north},${east},${south}`)
    if (options.bounded) {
      url.searchParams.set('bounded', '1')
    }
  }

  return url.toString()
}

export const normalizeGeocoderResults = (payload: unknown): GeocodeResult[] => {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.flatMap((item, index) => {
    const result = item as NominatimResult
    const lat = parseNumber(result.lat)
    const lng = parseNumber(result.lon)
    const label = normalizeOptionalText(result.display_name)
    if (lat === null || lng === null || !label) {
      return []
    }

    return [
      {
        id: String(result.place_id ?? index),
        label,
        center: [lng, lat] as [number, number],
        bounds: boundsFromNominatim(result.boundingbox),
      },
    ]
  })
}

const buildGeocoderAttempts = (
  config: GeocoderConfig,
  biasBounds?: MapBounds | null,
): GeocoderAttempt[] => {
  const attempts: GeocoderAttempt[] = []
  const seen = new Set<string>()

  const pushAttempt = (
    provider: GeocoderProviderConfig | null,
    attemptBiasBounds: MapBounds | null,
    bounded: boolean,
  ) => {
    if (!provider) {
      return
    }

    const key = [
      provider.endpoint,
      provider.countryCodes.join(','),
      attemptBiasBounds ? 'biased' : 'unbiased',
      bounded ? 'bounded' : 'open',
    ].join('|')

    if (seen.has(key)) {
      return
    }
    seen.add(key)
    attempts.push({
      provider,
      biasBounds: attemptBiasBounds,
      bounded,
    })
  }

  if (biasBounds) {
    pushAttempt(config.primary, biasBounds, true)
  }
  pushAttempt(config.primary, null, false)

  if (config.fallback) {
    if (biasBounds) {
      pushAttempt(config.fallback, biasBounds, true)
    }
    pushAttempt(config.fallback, null, false)
  }

  return attempts
}

export const searchAddresses = async (
  query: string,
  options: SearchAddressesOptions = {},
): Promise<GeocodeResult[]> => {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const config = options.config ?? resolveGeocoderConfig()
  const attempts = buildGeocoderAttempts(config, options.biasBounds)
  let lastError: Error | null = null
  let sawSuccessfulResponse = false

  for (const attempt of attempts) {
    try {
      await checkServiceReadiness({
        endpoint: attempt.provider.endpoint,
        expectedPath: LOCAL_PROXY_PATH,
        expectedService: 'geocode-proxy',
        unavailableMessage: GEOCODER_SERVICE_UNAVAILABLE_MESSAGE,
        degradedMessage: GEOCODER_SERVICE_DEGRADED_MESSAGE,
        fetchImpl,
      })
      const { response, payload } = await fetchJson(
        buildGeocoderUrl(trimmedQuery, attempt.provider, config.limit, {
          biasBounds: attempt.biasBounds,
          bounded: attempt.bounded,
        }),
        {
          fetchImpl,
        },
      )

      if (!response.ok) {
        throw new Error(`Geocoder request failed with ${response.status}.`)
      }

      sawSuccessfulResponse = true
      const results = normalizeGeocoderResults(payload)
      if (results.length > 0) {
        return results
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Geocoder request failed.')
    }
  }

  if (sawSuccessfulResponse) {
    return []
  }

  throw lastError ?? new Error('Geocoder request failed.')
}
