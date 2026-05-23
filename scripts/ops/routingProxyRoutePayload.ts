import { parseRoutingNumber } from './routingProxyConfig'
import type { OsrmRoutePayload, RoutingPathEntry } from './routingProxyTypes'

const normalizeRouteGeometry = (value: unknown): [number, number][] | null => {
  if (!Array.isArray(value)) {
    return null
  }

  const coordinates = value.filter(
    (coordinate): coordinate is [number, number] =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      typeof coordinate[0] === 'number' &&
      Number.isFinite(coordinate[0]) &&
      typeof coordinate[1] === 'number' &&
      Number.isFinite(coordinate[1]),
  )

  return coordinates.length >= 2 ? coordinates : null
}

export const normalizeOsrmRoutePayload = (
  payload: unknown,
  destination: [number, number],
): RoutingPathEntry | null => {
  const result = payload as OsrmRoutePayload
  if (result.code === 'NoRoute') {
    return {
      destination,
      distanceMeters: null,
      durationSeconds: null,
      estimated: false,
      geometry: null,
    }
  }

  if (result.code !== 'Ok') {
    return null
  }

  const route = Array.isArray(result.routes) ? result.routes[0] : null
  if (!route || typeof route !== 'object') {
    return null
  }

  return {
    destination,
    distanceMeters: parseRoutingNumber(route.distance),
    durationSeconds: parseRoutingNumber(route.duration),
    estimated: false,
    geometry: normalizeRouteGeometry(route.geometry?.coordinates),
  }
}
