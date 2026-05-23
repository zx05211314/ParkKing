import type {
  RoutingPathRequest,
  RoutingProfile,
  RoutingProxyProviderConfig,
  RoutingProxyRequest,
} from './routingProxyTypes'

const PROFILE_ALIASES: Record<RoutingProfile, string> = {
  walking: 'foot',
  driving: 'car',
}

const formatCoordinate = ([lng, lat]: [number, number]) => `${lng},${lat}`

export const buildMatrixUpstreamUrl = (
  provider: RoutingProxyProviderConfig,
  request: RoutingProxyRequest,
) => {
  const base = provider.endpoint.replace(/[\\/]+$/g, '')
  const coordinates = [request.origin, ...request.destinations]
    .map(formatCoordinate)
    .join(';')
  const url = new URL(`${base}/table/v1/${PROFILE_ALIASES[request.profile]}/${coordinates}`)
  url.searchParams.set('sources', '0')
  url.searchParams.set(
    'destinations',
    request.destinations.map((_, index) => String(index + 1)).join(';'),
  )
  url.searchParams.set('annotations', 'duration,distance')
  url.searchParams.set('skip_waypoints', 'true')
  return url.toString()
}

export const buildRouteUpstreamUrl = (
  provider: RoutingProxyProviderConfig,
  request: RoutingPathRequest,
) => {
  const base = provider.endpoint.replace(/[\\/]+$/g, '')
  const coordinates = [request.origin, request.destination].map(formatCoordinate).join(';')
  const url = new URL(`${base}/route/v1/${PROFILE_ALIASES[request.profile]}/${coordinates}`)
  url.searchParams.set('overview', 'full')
  url.searchParams.set('geometries', 'geojson')
  url.searchParams.set('steps', 'false')
  return url.toString()
}
