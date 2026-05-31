import { bearing } from '@turf/turf'
import { point } from '@turf/turf'
import type { Geometry, Position } from 'geojson'

type LngLat = [number, number]

const toLngLat = (position: Position): LngLat | null =>
  typeof position[0] === 'number' && typeof position[1] === 'number'
    ? [position[0], position[1]]
    : null

const toLine = (coordinates: Position[]): LngLat[] =>
  coordinates
    .map((position) => toLngLat(position))
    .filter((position): position is LngLat => Boolean(position))

export const extractLines = (geometry: Geometry): [number, number][][] => {
  if (geometry.type === 'LineString') {
    return [toLine(geometry.coordinates)]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.map((line) => toLine(line))
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap((child) => extractLines(child))
  }
  return []
}

export const normalizeBearing = (value: number) => {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export const endpointBearings = (line: [number, number][]) => {
  const start = line[0]
  const next = line[1]
  const end = line[line.length - 1]
  const prev = line[line.length - 2]
  return {
    startBearing: normalizeBearing(bearing(point(start), point(next))),
    endBearing: normalizeBearing(bearing(point(end), point(prev))),
  }
}

export const angularSpread = (bearings: number[]): number => {
  if (bearings.length < 2) {
    return 0
  }
  const sorted = [...bearings].sort((a, b) => a - b)
  let maxGap = 0
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]
    const next = sorted[(i + 1) % sorted.length]
    const gap = i === sorted.length - 1 ? 360 - current + next : next - current
    if (gap > maxGap) {
      maxGap = gap
    }
  }
  return 360 - maxGap
}

export const buildHistogram = (values: number[], binSize: number) => {
  const bins = Math.ceil(360 / binSize)
  const histogram: Record<string, number> = {}
  for (let i = 0; i < bins; i += 1) {
    const start = i * binSize
    const end = Math.min(360, start + binSize - 1)
    histogram[`${start}-${end}`] = 0
  }
  values.forEach((value) => {
    const clamped = Math.max(0, Math.min(360, value))
    const binIndex = Math.min(bins - 1, Math.floor(clamped / binSize))
    const start = binIndex * binSize
    const end = Math.min(360, start + binSize - 1)
    const key = `${start}-${end}`
    histogram[key] = (histogram[key] ?? 0) + 1
  })
  return histogram
}
