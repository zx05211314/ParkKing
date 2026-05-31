import { parseRoutingNumber } from './routingProxyConfig'
import type { OsrmTablePayload, RoutingMatrixEntry } from './routingProxyTypes'

const normalizeFallbackCells = (value: unknown) =>
  new Set(
    (Array.isArray(value) ? value : [])
      .filter(
        (cell): cell is [number, number] =>
          Array.isArray(cell) &&
          cell.length === 2 &&
          Number.isFinite(cell[0]) &&
          Number.isFinite(cell[1]),
      )
      .map((cell) => `${cell[0]}:${cell[1]}`),
  )

export const normalizeOsrmTablePayload = (
  payload: unknown,
  destinations: [number, number][],
): RoutingMatrixEntry[] | null => {
  const result = payload as OsrmTablePayload
  if (result.code === 'NoTable') {
    return destinations.map((destination) => ({
      destination,
      distanceMeters: null,
      durationSeconds: null,
      estimated: false,
    }))
  }
  if (result.code !== 'Ok') {
    return null
  }

  const durations = Array.isArray(result.durations) ? result.durations[0] : null
  const distances = Array.isArray(result.distances) ? result.distances[0] : null
  if (!Array.isArray(durations) || !Array.isArray(distances)) {
    return null
  }

  const fallbackCells = normalizeFallbackCells(result.fallback_speed_cells)

  return destinations.map((destination, index) => ({
    destination,
    distanceMeters: parseRoutingNumber(distances[index]),
    durationSeconds: parseRoutingNumber(durations[index]),
    estimated: fallbackCells.has(`0:${index}`),
  }))
}
