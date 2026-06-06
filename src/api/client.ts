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
  // Vite only replaces statically analyzable import.meta.env property reads.
  return {
    VITE_DATA_BASE_URL: import.meta.env.VITE_DATA_BASE_URL,
    VITE_DATASET_DIR: import.meta.env.VITE_DATASET_DIR,
    VITE_GEOCODER_COUNTRY_CODES: import.meta.env.VITE_GEOCODER_COUNTRY_CODES,
    VITE_GEOCODER_FALLBACK_URL: import.meta.env.VITE_GEOCODER_FALLBACK_URL,
    VITE_GEOCODER_LIMIT: import.meta.env.VITE_GEOCODER_LIMIT,
    VITE_GEOCODER_URL: import.meta.env.VITE_GEOCODER_URL,
    VITE_ISSUE_REPORTS_URL: import.meta.env.VITE_ISSUE_REPORTS_URL,
    VITE_MAP_ATTRIBUTION: import.meta.env.VITE_MAP_ATTRIBUTION,
    VITE_MAP_RASTER_MAX_ZOOM: import.meta.env.VITE_MAP_RASTER_MAX_ZOOM,
    VITE_MAP_RASTER_TILE_SIZE: import.meta.env.VITE_MAP_RASTER_TILE_SIZE,
    VITE_MAP_RASTER_URL: import.meta.env.VITE_MAP_RASTER_URL,
    VITE_MAP_STYLE_URL: import.meta.env.VITE_MAP_STYLE_URL,
    VITE_PARKING_ANSWER_URL: import.meta.env.VITE_PARKING_ANSWER_URL,
    VITE_REPORTS_URL: import.meta.env.VITE_REPORTS_URL,
    VITE_ROUTING_FALLBACK_URL: import.meta.env.VITE_ROUTING_FALLBACK_URL,
    VITE_ROUTING_URL: import.meta.env.VITE_ROUTING_URL,
    VITE_SAVED_PLANS_URL: import.meta.env.VITE_SAVED_PLANS_URL,
    VITE_SYNC_BASE_URL: import.meta.env.VITE_SYNC_BASE_URL,
    VITE_SYNC_BOOTSTRAP_PATH: import.meta.env.VITE_SYNC_BOOTSTRAP_PATH,
    VITE_SYNC_ISSUES_PATH: import.meta.env.VITE_SYNC_ISSUES_PATH,
    VITE_SYNC_READINESS_PATH: import.meta.env.VITE_SYNC_READINESS_PATH,
    VITE_SYNC_REPORTS_PATH: import.meta.env.VITE_SYNC_REPORTS_PATH,
    VITE_SYNC_SAVED_PLANS_PATH: import.meta.env.VITE_SYNC_SAVED_PLANS_PATH,
    VITE_SYNC_SCOPE: import.meta.env.VITE_SYNC_SCOPE,
    VITE_SYNC_STATUS_PATH: import.meta.env.VITE_SYNC_STATUS_PATH,
    VITE_VERIFY_HASHES: import.meta.env.VITE_VERIFY_HASHES,
  }
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
