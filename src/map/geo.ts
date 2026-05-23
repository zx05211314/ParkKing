export const MOCK_LOCATION: [number, number] = [121.5648, 25.0336]

export { distanceMeters, getPathMidpoint } from './geoMath'

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
