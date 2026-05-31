import { normalizeGeocodeText } from './geocodeProxyParsing'
import type {
  GeocodeProxyAttempt,
  GeocodeProxyConfig,
  GeocodeProxyProviderConfig,
  GeocodeProxyRequest,
} from './geocodeProxyTypes'

export const buildGeocodeAttempts = (
  config: GeocodeProxyConfig,
  request: GeocodeProxyRequest,
): GeocodeProxyAttempt[] => {
  const attempts: GeocodeProxyAttempt[] = []
  const seen = new Set<string>()

  const pushAttempt = (
    provider: GeocodeProxyProviderConfig | null,
    viewbox: string | null,
    bounded: boolean,
  ) => {
    if (!provider) {
      return
    }

    const key = [
      provider.endpoint,
      provider.countryCodes.join(','),
      viewbox ?? '',
      bounded ? 'bounded' : 'open',
    ].join('|')
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    attempts.push({
      provider,
      viewbox,
      bounded,
    })
  }

  const normalizedViewbox = normalizeGeocodeText(request.viewbox)
  if (normalizedViewbox) {
    pushAttempt(config.primary, normalizedViewbox, Boolean(request.bounded))
    pushAttempt(config.primary, null, false)
    pushAttempt(config.fallback, normalizedViewbox, Boolean(request.bounded))
    pushAttempt(config.fallback, null, false)
    return attempts
  }

  pushAttempt(config.primary, null, false)
  pushAttempt(config.fallback, null, false)
  return attempts
}
