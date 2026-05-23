import { clampLimit } from './geocodeProxyParsing'
import { buildGeocodeUpstreamUrl } from './geocodeProxyRequestKeys'
import type {
  FetchLike,
  GeocodeProxyAttempt,
  GeocodeProxyConfig,
  GeocodeProxyRequest,
} from './geocodeProxyTypes'
export { buildGeocodeAttempts } from './geocodeProxyAttempts'
export {
  buildGeocodeCacheKey,
  buildGeocodeUpstreamUrl,
} from './geocodeProxyRequestKeys'

export const requestGeocodeResults = async (
  attempts: GeocodeProxyAttempt[],
  request: GeocodeProxyRequest,
  config: GeocodeProxyConfig,
  fetchImpl: FetchLike,
) => {
  const effectiveLimit = clampLimit(request.limit, config.limit)
  let sawSuccessfulResponse = false
  let lastError: Error | null = null

  for (const attempt of attempts) {
    try {
      const response = await fetchImpl(
        buildGeocodeUpstreamUrl(attempt.provider, request, effectiveLimit, {
          viewbox: attempt.viewbox,
          bounded: attempt.bounded,
        }),
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': config.userAgent,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Upstream geocoder failed with ${response.status}.`)
      }

      sawSuccessfulResponse = true
      const payload = await response.json()
      const result = Array.isArray(payload) ? payload : []
      if (result.length > 0) {
        return {
          results: result,
          sawSuccessfulResponse,
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Upstream geocoder failed.')
    }
  }

  if (sawSuccessfulResponse) {
    return {
      results: [],
      sawSuccessfulResponse,
    }
  }

  throw lastError ?? new Error('Upstream geocoder failed.')
}
