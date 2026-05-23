import {
  createEndpointUrl,
  fetchJson,
  getApiErrorMessage,
  normalizeOptionalText,
  readViteEnv,
  resolveLocalhostProxyEndpoint,
  type ViteEnvLike,
} from '../api/client'
import { checkServiceReadiness } from '../api/serviceReadiness'

export type RouteProfile = 'walking' | 'driving'

const LOCAL_PROXY_PATH = '/api/route'
export const ROUTING_MATRIX_UNAVAILABLE_MESSAGE =
  'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.'
export const ROUTING_PATH_UNAVAILABLE_MESSAGE =
  'Live map routing is not configured for this deployment. External Walk/Drive links still work.'
export const ROUTING_MATRIX_DEGRADED_MESSAGE =
  'Live ETA routing service is degraded'
export const ROUTING_PATH_DEGRADED_MESSAGE =
  'Live map routing service is degraded'

export interface RoutingProviderConfig {
  endpoint: string
}

export interface RoutingConfig {
  primary: RoutingProviderConfig
  fallback: RoutingProviderConfig | null
}

export interface RoutingRuntimeAvailability {
  etaAvailable: boolean
  etaMessage: string | null
  pathAvailable: boolean
  pathMessage: string | null
}

export interface RouteMatrixEntry {
  destination: [number, number]
  distanceMeters: number | null
  durationSeconds: number | null
  estimated: boolean
}

export interface RoutePathEntry {
  destination: [number, number]
  distanceMeters: number | null
  durationSeconds: number | null
  estimated: boolean
  geometry: [number, number][] | null
}

interface RoutingProxyResponse {
  routes?: RouteMatrixEntry[]
  route?: RoutePathEntry | null
  error?: string
}

interface SearchRouteMatrixOptions {
  config?: RoutingConfig
  fetchImpl?: typeof fetch
}

interface SearchRoutePathOptions {
  config?: RoutingConfig
  fetchImpl?: typeof fetch
}

const formatCoordinate = ([lng, lat]: [number, number]) => `${lng},${lat}`

export const resolveRoutingConfig = (env: ViteEnvLike = readViteEnv()): RoutingConfig => {
  const primaryEndpoint =
    normalizeOptionalText(env.VITE_ROUTING_URL) ??
    resolveLocalhostProxyEndpoint(LOCAL_PROXY_PATH) ??
    LOCAL_PROXY_PATH
  const fallbackEndpoint = normalizeOptionalText(env.VITE_ROUTING_FALLBACK_URL)

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
  }
}

export const buildRoutingUrl = (
  origin: [number, number],
  destinations: [number, number][],
  profile: RouteProfile,
  provider: RoutingProviderConfig = resolveRoutingConfig().primary,
) => {
  const url = createEndpointUrl(provider.endpoint)
  url.searchParams.set('origin', formatCoordinate(origin))
  url.searchParams.set(
    'destinations',
    destinations.map((destination) => formatCoordinate(destination)).join(';'),
  )
  url.searchParams.set('profile', profile)
  return url.toString()
}

export const buildRoutePathUrl = (
  origin: [number, number],
  destination: [number, number],
  profile: RouteProfile,
  provider: RoutingProviderConfig = resolveRoutingConfig().primary,
) => {
  const url = createEndpointUrl(provider.endpoint)
  url.searchParams.set('origin', formatCoordinate(origin))
  url.searchParams.set('destination', formatCoordinate(destination))
  url.searchParams.set('profile', profile)
  url.searchParams.set('mode', 'path')
  return url.toString()
}

const normalizeRoutingResponse = (payload: unknown): RouteMatrixEntry[] => {
  if (!payload || typeof payload !== 'object') {
    return []
  }
  const result = payload as RoutingProxyResponse
  return Array.isArray(result.routes) ? result.routes : []
}

const normalizeRoutePathResponse = (payload: unknown): RoutePathEntry | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const result = payload as RoutingProxyResponse
  if (!result.route || typeof result.route !== 'object') {
    return null
  }
  return result.route
}

const isImplicitLocalProxyConfig = (
  config: RoutingConfig,
  env: ViteEnvLike = readViteEnv(),
) =>
  config.primary.endpoint === LOCAL_PROXY_PATH &&
  config.fallback === null &&
  normalizeOptionalText(env.VITE_ROUTING_URL) === null &&
  resolveLocalhostProxyEndpoint(LOCAL_PROXY_PATH) === null

const isImplicitLocalProxyDeploymentUnavailable = (
  config: RoutingConfig,
  env: ViteEnvLike = readViteEnv(),
) => typeof window !== 'undefined' && isImplicitLocalProxyConfig(config, env)

export const getRoutingRuntimeAvailability = (
  config: RoutingConfig = resolveRoutingConfig(),
  env: ViteEnvLike = readViteEnv(),
): RoutingRuntimeAvailability => {
  if (!isImplicitLocalProxyDeploymentUnavailable(config, env)) {
    return {
      etaAvailable: true,
      etaMessage: null,
      pathAvailable: true,
      pathMessage: null,
    }
  }

  return {
    etaAvailable: false,
    etaMessage: ROUTING_MATRIX_UNAVAILABLE_MESSAGE,
    pathAvailable: false,
    pathMessage: ROUTING_PATH_UNAVAILABLE_MESSAGE,
  }
}

const getRoutingFailureMessage = ({
  config,
  payload,
  response,
  mode,
}: {
  config: RoutingConfig
  payload: unknown
  response: Response
  mode: 'matrix' | 'path'
}) => {
  const runtimeAvailability = getRoutingRuntimeAvailability(config)
  if (response.status === 404) {
    if (mode === 'matrix' && !runtimeAvailability.etaAvailable) {
      return runtimeAvailability.etaMessage ?? ROUTING_MATRIX_UNAVAILABLE_MESSAGE
    }
    if (mode === 'path' && !runtimeAvailability.pathAvailable) {
      return runtimeAvailability.pathMessage ?? ROUTING_PATH_UNAVAILABLE_MESSAGE
    }
  }

  return getApiErrorMessage(
    payload,
    `Routing request failed with ${response.status}.`,
  )
}

export const isRoutingAvailabilityMessage = (message: string | null | undefined) =>
  message === ROUTING_MATRIX_UNAVAILABLE_MESSAGE ||
  message === ROUTING_PATH_UNAVAILABLE_MESSAGE

export const searchRouteMatrix = async (
  origin: [number, number],
  destinations: [number, number][],
  profile: RouteProfile,
  options: SearchRouteMatrixOptions = {},
): Promise<RouteMatrixEntry[]> => {
  if (destinations.length === 0) {
    return []
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const config = options.config ?? resolveRoutingConfig()
  const providers = [config.primary, config.fallback].filter(
    (provider): provider is RoutingProviderConfig => provider !== null,
  )
  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      await checkServiceReadiness({
        endpoint: provider.endpoint,
        expectedPath: LOCAL_PROXY_PATH,
        expectedService: 'routing-proxy',
        unavailableMessage: ROUTING_MATRIX_UNAVAILABLE_MESSAGE,
        degradedMessage: ROUTING_MATRIX_DEGRADED_MESSAGE,
        fetchImpl,
      })
      const { response, payload } = await fetchJson(
        buildRoutingUrl(origin, destinations, profile, provider),
        {
          fetchImpl,
        },
      )

      if (!response.ok) {
        throw new Error(
          getRoutingFailureMessage({
            config,
            payload,
            response,
            mode: 'matrix',
          }),
        )
      }

      return normalizeRoutingResponse(payload)
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Routing request failed.')
    }
  }

  throw lastError ?? new Error('Routing request failed.')
}

export const searchRoutePath = async (
  origin: [number, number],
  destination: [number, number],
  profile: RouteProfile,
  options: SearchRoutePathOptions = {},
): Promise<RoutePathEntry> => {
  const fetchImpl = options.fetchImpl ?? fetch
  const config = options.config ?? resolveRoutingConfig()
  const providers = [config.primary, config.fallback].filter(
    (provider): provider is RoutingProviderConfig => provider !== null,
  )
  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      await checkServiceReadiness({
        endpoint: provider.endpoint,
        expectedPath: LOCAL_PROXY_PATH,
        expectedService: 'routing-proxy',
        unavailableMessage: ROUTING_PATH_UNAVAILABLE_MESSAGE,
        degradedMessage: ROUTING_PATH_DEGRADED_MESSAGE,
        fetchImpl,
      })
      const { response, payload } = await fetchJson(
        buildRoutePathUrl(origin, destination, profile, provider),
        {
          fetchImpl,
        },
      )

      if (!response.ok) {
        throw new Error(
          getRoutingFailureMessage({
            config,
            payload,
            response,
            mode: 'path',
          }),
        )
      }

      const route = normalizeRoutePathResponse(payload)
      if (route) {
        return route
      }

      throw new Error('Routing request did not return a route path.')
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error('Routing request failed.')
    }
  }

  throw lastError ?? new Error('Routing request failed.')
}
