import type { Geometry, LineString, MultiLineString, Position } from 'geojson'

type LngLat = [number, number]

const toLngLat = (position: Position): LngLat | null =>
  typeof position[0] === 'number' && typeof position[1] === 'number'
    ? [position[0], position[1]]
    : null

const toLine = (coordinates: Position[]): LngLat[] =>
  coordinates
    .map((position) => toLngLat(position))
    .filter((position): position is LngLat => Boolean(position))

const sampleCoordinates = (
  coordinates: LngLat[],
  maxPoints = 64,
) => {
  if (coordinates.length <= maxPoints) {
    return coordinates
  }
  const step = Math.ceil(coordinates.length / maxPoints)
  return coordinates.filter((_, index) => index % step === 0)
}

const squaredDistance = (left: LngLat, right: LngLat) => {
  const deltaX = left[0] - right[0]
  const deltaY = left[1] - right[1]
  return deltaX * deltaX + deltaY * deltaY
}

const getRepresentativePolygonLine = (
  rings: Position[][],
): LngLat[] | null => {
  const sampled = sampleCoordinates(rings.flatMap((ring) => toLine(ring)))
  if (sampled.length < 2) {
    return null
  }

  let bestPair: [LngLat, LngLat] | null = null
  let bestDistance = 0

  for (let leftIndex = 0; leftIndex < sampled.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sampled.length; rightIndex += 1) {
      const left = sampled[leftIndex]
      const right = sampled[rightIndex]
      if (!left || !right) {
        continue
      }
      const distance = squaredDistance(left, right)
      if (distance > bestDistance) {
        bestDistance = distance
        bestPair = [left, right]
      }
    }
  }

  if (!bestPair || bestDistance === 0) {
    return null
  }

  return bestPair
}

export const extractLines = (geometry: Geometry): [number, number][][] => {
  if (geometry.type === 'LineString') {
    return [toLine(geometry.coordinates)]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates.map((line) => toLine(line))
  }
  if (geometry.type === 'Polygon') {
    const representative = getRepresentativePolygonLine(geometry.coordinates)
    return representative ? [representative] : []
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) =>
        getRepresentativePolygonLine(polygon),
      )
      .filter((line): line is [number, number][] => Boolean(line))
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap((child) => extractLines(child))
  }
  return []
}

export const midpointForLine = (coords: [number, number][]) => {
  if (coords.length === 0) {
    return null
  }
  const mid = coords[Math.floor(coords.length / 2)]
  return mid ? ([mid[0], mid[1]] as [number, number]) : null
}

export const centerFromLineGeometry = (
  geometry: LineString | MultiLineString,
): LngLat | null => {
  const positions = geometry.type === 'LineString'
    ? geometry.coordinates
    : geometry.coordinates.flat()
  const coordinates = positions
    .map((position) => toLngLat(position))
    .filter((position): position is LngLat => Boolean(position))
  if (coordinates.length === 0) {
    return null
  }
  const [longitude, latitude] = coordinates.reduce(
    ([longitudeSum, latitudeSum], coordinate) => [
      longitudeSum + coordinate[0],
      latitudeSum + coordinate[1],
    ],
    [0, 0],
  )
  return [longitude / coordinates.length, latitude / coordinates.length]
}

export const extractRepresentativePoint = (
  geometry: Geometry,
): [number, number] | null => {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'MultiPoint') {
    const coord = geometry.coordinates[0]
    return coord ? ([coord[0], coord[1]] as [number, number]) : null
  }
  if (geometry.type === 'LineString') {
    return midpointForLine(geometry.coordinates as [number, number][])
  }
  if (geometry.type === 'MultiLineString') {
    const line = geometry.coordinates[0]
    return line ? midpointForLine(line as [number, number][]) : null
  }
  if (geometry.type === 'Polygon') {
    const coord = geometry.coordinates[0]?.[0]
    return coord ? ([coord[0], coord[1]] as [number, number]) : null
  }
  if (geometry.type === 'MultiPolygon') {
    const coord = geometry.coordinates[0]?.[0]?.[0]
    return coord ? ([coord[0], coord[1]] as [number, number]) : null
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) {
      const point = extractRepresentativePoint(child)
      if (point) {
        return point
      }
    }
  }
  return null
}
