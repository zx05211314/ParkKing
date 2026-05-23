import type { GeocodeResult } from '../map/geocoder'

const MAP_PIN_DECIMALS = 6

const formatCoordinate = (value: number) => value.toFixed(MAP_PIN_DECIMALS)

export const buildMapPinGeocodeResult = (
  location: [number, number],
): GeocodeResult => {
  const [lng, lat] = location
  const formattedLng = formatCoordinate(lng)
  const formattedLat = formatCoordinate(lat)

  return {
    id: `map-pin:${formattedLng},${formattedLat}`,
    label: `Map pin ${formattedLat}, ${formattedLng}`,
    center: [lng, lat],
    bounds: null,
  }
}
