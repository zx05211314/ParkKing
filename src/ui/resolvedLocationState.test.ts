import { describe, expect, it } from 'vitest'
import { MOCK_LOCATION } from '../map/geo'
import {
  buildResolvedLocationState,
  getInitialResolvedLocationState,
} from './resolvedLocationState'

describe('resolvedLocationState', () => {
  it('starts in locating mode when device location is enabled', () => {
    expect(getInitialResolvedLocationState(false)).toEqual({
      userLocation: null,
      locationLabel: 'Locating',
      locationStatus: 'locating',
    })
  })

  it('starts in mock mode when mock location is enabled', () => {
    expect(getInitialResolvedLocationState(true)).toEqual({
      userLocation: MOCK_LOCATION,
      locationLabel: 'Mock',
      locationStatus: 'mock',
    })
  })

  it('uses the resolved device location when available', () => {
    expect(
      buildResolvedLocationState({
        useMockLocation: false,
        deviceLocation: [121.565, 25.033],
      }),
    ).toEqual({
      userLocation: [121.565, 25.033],
      locationLabel: 'Device',
      locationStatus: 'device',
    })
  })

  it('marks device location as unavailable when geolocation fails', () => {
    expect(
      buildResolvedLocationState({
        useMockLocation: false,
        deviceLocation: null,
      }),
    ).toEqual({
      userLocation: null,
      locationLabel: 'Unavailable',
      locationStatus: 'unavailable',
    })
  })
})
