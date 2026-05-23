import { describe, expect, it } from 'vitest'
import { buildMapPinGeocodeResult } from './mapPinGeocode'

describe('buildMapPinGeocodeResult', () => {
  it('creates a stable synthetic geocode result for a clicked map coordinate', () => {
    const result = buildMapPinGeocodeResult([121.57465611063279, 25.032494081749498])

    expect(result).toEqual({
      id: 'map-pin:121.574656,25.032494',
      label: 'Map pin 25.032494, 121.574656',
      center: [121.57465611063279, 25.032494081749498],
      bounds: null,
    })
  })
})
