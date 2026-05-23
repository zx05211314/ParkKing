import type { Geometry } from 'geojson'

const sampleCoordinates = (
  coordinates: [number, number][],
  maxPoints = 64,
) => {
  if (coordinates.length <= maxPoints) {
    return coordinates
  }
  const step = Math.ceil(coordinates.length / maxPoints)
  return coordinates.filter((_, index) => index % step === 0)
}

const squaredDistance = (left: [number, number], right: [number, number]) => {
  const deltaX = left[0] - right[0]
  const deltaY = left[1] - right[1]
  return deltaX * deltaX + deltaY * deltaY
}

const getRepresentativePolygonLine = (
  rings: [number, number][][],
): [number, number][] | null => {
  const sampled = sampleCoordinates(rings.flat())
  if (sampled.length < 2) {
    return null
  }

  let bestPair: [[number, number], [number, number]] | null = null
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
    return [geometry.coordinates]
  }
  if (geometry.type === 'MultiLineString') {
    return geometry.coordinates
  }
  if (geometry.type === 'Polygon') {
    const representative = getRepresentativePolygonLine(
      geometry.coordinates as [number, number][][],
    )
    return representative ? [representative] : []
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) =>
        getRepresentativePolygonLine(polygon as [number, number][][]),
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
