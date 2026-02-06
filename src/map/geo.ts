export const MOCK_LOCATION: [number, number] = [121.5648, 25.0336]

export const getBrowserLocation = (timeoutMs = 6000): Promise<[number, number] | null> => {
  if (!navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer)
        resolve([position.coords.longitude, position.coords.latitude])
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 5000,
      },
    )
  })
}

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
