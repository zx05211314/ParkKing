import type {
  RoutingPathRequest,
  RoutingProxyConfig,
  RoutingProxyRequest,
} from './routingProxyTypes'

export const buildMatrixCacheKey = (
  request: RoutingProxyRequest,
  config: RoutingProxyConfig,
) => {
  return JSON.stringify({
    mode: 'matrix',
    profile: request.profile,
    origin: request.origin.map((value) => value.toFixed(6)),
    destinations: request.destinations.map((destination) =>
      destination.map((value) => value.toFixed(6)),
    ),
    primary: config.primary.endpoint,
    fallback: config.fallback?.endpoint ?? null,
  })
}

export const buildPathCacheKey = (
  request: RoutingPathRequest,
  config: RoutingProxyConfig,
) => {
  return JSON.stringify({
    mode: 'path',
    profile: request.profile,
    origin: request.origin.map((value) => value.toFixed(6)),
    destination: request.destination.map((value) => value.toFixed(6)),
    primary: config.primary.endpoint,
    fallback: config.fallback?.endpoint ?? null,
  })
}
