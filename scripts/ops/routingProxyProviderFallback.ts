import type { FetchLike, RoutingProxyProviderConfig } from './routingProxyTypes'
import { extractRoutingUpstreamMessage } from './routingProxyPayloads'

const readRoutingResponseJson = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const requestFromRoutingProviders = async <T>({
  providers,
  fetchImpl,
  userAgent,
  requestTimeoutMs,
  buildUrl,
  normalize,
}: {
  providers: RoutingProxyProviderConfig[]
  fetchImpl: FetchLike
  userAgent: string
  requestTimeoutMs: number
  buildUrl: (provider: RoutingProxyProviderConfig) => string
  normalize: (status: number, payload: unknown) => T | null
}) => {
  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      const response = await fetchImpl(buildUrl(provider), {
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
        signal: AbortSignal.timeout(requestTimeoutMs),
      })
      const payload = await readRoutingResponseJson(response)
      const normalized = normalize(response.status, payload)
      if (normalized) {
        return normalized
      }
      throw new Error(extractRoutingUpstreamMessage(response.status, payload))
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Upstream router failed.')
    }
  }

  throw lastError ?? new Error('Upstream router failed.')
}
