import { describe, expect, it } from 'vitest'
import { resolveDistrictInputs } from './checkDistrictInputConfig'

describe('checkDistrictInputConfig', () => {
  it('resolves required and optional aliases from config inputs', () => {
    expect(
      resolveDistrictInputs({
        inputs: {
          district_bounds: 'bounds.geojson',
          red_yellow: 'red.geojson',
          bus_stops: 'bus.geojson',
          hydrants: 'hydrants.geojson',
          cross_walks: 'crosswalks.geojson',
          signOverrides: 'overrides.geojson',
        },
      }),
    ).toEqual({
      districtBounds: 'bounds.geojson',
      redYellow: 'red.geojson',
      busStops: 'bus.geojson',
      hydrants: 'hydrants.geojson',
      crosswalks: 'crosswalks.geojson',
      sign_overrides: 'overrides.geojson',
    })
  })
})
