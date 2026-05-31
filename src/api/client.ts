export type ViteEnvLike = Record<string, string | undefined>

interface FetchJsonOptions extends Omit<RequestInit, 'headers'> {
  fetchImpl?: typeof fetch
  headers?: HeadersInit
}

const DEFAULT_JSON_HEADERS = {
  Accept: 'application/json',
}

export const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const readViteEnv = (): ViteEnvLike => {
  const meta = import.meta as { env?: ViteEnvLike }
  return meta.env ?? {}
}

export const resolveLocalhostProxyEndpoint = (proxyPath: string) => {
  if (typeof window === 'undefined') {
    return null
  }
  const hostname = window.location.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return proxyPath
  }
  return null
}

export const createEndpointUrl = (endpoint: string) => {
  if (/^https?:\/\//i.test(endpoint)) {
    return new URL(endpoint)
  }
  if (typeof window !== 'undefined') {
    return new URL(endpoint, window.location.origin)
  }
  return new URL(endpoint, 'http://localhost')
}

export const fetchJson = async (
  endpoint: string,
  {
    fetchImpl = fetch,
    headers,
    ...init
  }: FetchJsonOptions = {},
) => {
  const response = await fetchImpl(createEndpointUrl(endpoint).toString(), {
    ...init,
    headers: {
      ...DEFAULT_JSON_HEADERS,
      ...(headers ?? {}),
    },
  })
  const payload = await response.json().catch(() => null)
  return {
    response,
    payload,
  }
}

export const getApiErrorMessage = (payload: unknown, fallback: string) => {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error
  }
  return fallback
}
