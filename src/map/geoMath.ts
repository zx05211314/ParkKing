export const getPathMidpoint = (path: [number, number][]): [number, number] => {
  if (path.length === 0) {
    return [0, 0]
  }

  const sum = path.reduce(
    (acc, point) => {
      acc[0] += point[0]
      acc[1] += point[1]
      return acc
    },
    [0, 0],
  )

  return [sum[0] / path.length, sum[1] / path.length]
}

export const distanceMeters = (
  a: [number, number],
  b: [number, number],
): number => {
  const toRad = (value: number) => (value * Math.PI) / 180
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const earthRadius = 6371000

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const lat1Rad = toRad(lat1)
  const lat2Rad = toRad(lat2)

  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinDLng * sinDLng

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return earthRadius * c
}

const projectLngLatToMeters = (
  coordinate: [number, number],
  origin: [number, number],
) => {
  const [, originLat] = origin
  const latRadians = (originLat * Math.PI) / 180
  return {
    x: (coordinate[0] - origin[0]) * 111_320 * Math.cos(latRadians),
    y: (coordinate[1] - origin[1]) * 110_540,
  }
}

const distanceToLineSegmentMeters = (
  point: [number, number],
  start: [number, number],
  end: [number, number],
) => {
  const projectedPoint = projectLngLatToMeters(point, point)
  const projectedStart = projectLngLatToMeters(start, point)
  const projectedEnd = projectLngLatToMeters(end, point)
  const segmentX = projectedEnd.x - projectedStart.x
  const segmentY = projectedEnd.y - projectedStart.y
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY

  if (segmentLengthSquared === 0) {
    return distanceMeters(point, start)
  }

  const pointX = projectedPoint.x - projectedStart.x
  const pointY = projectedPoint.y - projectedStart.y
  const t = Math.max(
    0,
    Math.min(1, (pointX * segmentX + pointY * segmentY) / segmentLengthSquared),
  )
  const closestX = projectedStart.x + t * segmentX
  const closestY = projectedStart.y + t * segmentY
  return Math.hypot(projectedPoint.x - closestX, projectedPoint.y - closestY)
}

export const pointToPathDistanceMeters = (
  point: [number, number],
  path: [number, number][],
) => {
  if (path.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  if (path.length === 1) {
    return distanceMeters(point, path[0])
  }

  let closest = Number.POSITIVE_INFINITY
  for (let index = 1; index < path.length; index += 1) {
    closest = Math.min(
      closest,
      distanceToLineSegmentMeters(point, path[index - 1], path[index]),
    )
  }
  return closest
}
