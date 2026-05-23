import type {
  FetchLike,
  RoutingPathEntry,
  RoutingPathRequest,
  RoutingProxyProviderConfig,
  RoutingProxyRequest,
} from './routingProxyTypes'
import {
  normalizeOsrmRoutePayload,
  normalizeOsrmTablePayload,
} from './routingProxyPayloads'
import { requestFromRoutingProviders } from './routingProxyProviderFallback'
import {
  buildMatrixUpstreamUrl,
  buildRouteUpstreamUrl,
} from './routingProxyUpstreamUrls'

export const requestRoutingMatrix = async (
  providers: RoutingProxyProviderConfig[],
  request: RoutingProxyRequest,
  fetchImpl: FetchLike,
  userAgent: string,
) =>
  requestFromRoutingProviders({
    providers,
    fetchImpl,
    userAgent,
    buildUrl: (provider) => buildMatrixUpstreamUrl(provider, request),
    normalize: (_status, payload) =>
      normalizeOsrmTablePayload(payload, request.destinations),
  })

export const requestRoutingPath = async (
  providers: RoutingProxyProviderConfig[],
  request: RoutingPathRequest,
  fetchImpl: FetchLike,
  userAgent: string,
): Promise<RoutingPathEntry> =>
  requestFromRoutingProviders({
    providers,
    fetchImpl,
    userAgent,
    buildUrl: (provider) => buildRouteUpstreamUrl(provider, request),
    normalize: (_status, payload) =>
      normalizeOsrmRoutePayload(payload, request.destination),
  })
