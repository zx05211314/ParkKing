import type { ServerResponse } from 'node:http'
import { getRoutingProxyErrorMessage, writeRoutingProxyJson } from './routingProxyResponses'
import type { RoutingProfile, RoutingProxyService } from './routingProxyTypes'

export const handleRoutingPathRequest = async ({
  service,
  res,
  profile,
  origin,
  destination,
}: {
  service: RoutingProxyService
  res: ServerResponse
  profile: RoutingProfile
  origin: [number, number]
  destination: [number, number]
}) => {
  try {
    const payload = await service.routePath({
      profile,
      origin,
      destination,
    })
    writeRoutingProxyJson(res, 200, { route: payload })
  } catch (error) {
    writeRoutingProxyJson(res, 502, { error: getRoutingProxyErrorMessage(error) })
  }

  return true
}

export const handleRoutingMatrixRequest = async ({
  service,
  res,
  profile,
  origin,
  destinations,
}: {
  service: RoutingProxyService
  res: ServerResponse
  profile: RoutingProfile
  origin: [number, number]
  destinations: [number, number][]
}) => {
  try {
    const payload = await service.route({
      profile,
      origin,
      destinations,
    })
    writeRoutingProxyJson(res, 200, { routes: payload })
  } catch (error) {
    writeRoutingProxyJson(res, 502, { error: getRoutingProxyErrorMessage(error) })
  }

  return true
}
