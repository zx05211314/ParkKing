import { normalizeGeocodeText } from './geocodeProxyParsing'
import type {
  GeocodeProxyConfig,
  GeocodeProxyProviderConfig,
  GeocodeProxyRequest,
} from './geocodeProxyTypes'

export const buildGeocodeCacheKey = (
  request: GeocodeProxyRequest,
  config: GeocodeProxyConfig,
  effectiveLimit: number,
) => {
  return JSON.stringify({
    q: request.query.trim().toLowerCase(),
    viewbox: normalizeGeocodeText(request.viewbox),
    bounded: Boolean(request.bounded),
    limit: effectiveLimit,
    primary: config.primary.endpoint,
    fallback: config.fallback?.endpoint ?? null,
    countries: config.primary.countryCodes.join(','),
  })
}

export const buildGeocodeUpstreamUrl = (
  provider: GeocodeProxyProviderConfig,
  request: GeocodeProxyRequest,
  effectiveLimit: number,
  options: {
    viewbox: string | null
    bounded: boolean
  },
) => {
  const url = new URL(provider.endpoint)
  url.searchParams.set('q', request.query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(effectiveLimit))

  if (provider.countryCodes.length > 0) {
    url.searchParams.set('countrycodes', provider.countryCodes.join(','))
  }

  if (options.viewbox) {
    url.searchParams.set('viewbox', options.viewbox)
    if (options.bounded) {
      url.searchParams.set('bounded', '1')
    }
  }

  return url.toString()
}
