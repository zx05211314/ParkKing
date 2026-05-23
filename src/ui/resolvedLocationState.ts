import { MOCK_LOCATION } from '../map/geo'

export type ResolvedLocationStatus =
  | 'mock'
  | 'locating'
  | 'device'
  | 'unavailable'

export interface ResolvedLocationState {
  userLocation: [number, number] | null
  locationLabel: string
  locationStatus: ResolvedLocationStatus
}

export const getInitialResolvedLocationState = (
  useMockLocation: boolean,
): ResolvedLocationState =>
  useMockLocation
    ? {
        userLocation: MOCK_LOCATION,
        locationLabel: 'Mock',
        locationStatus: 'mock',
      }
    : {
        userLocation: null,
        locationLabel: 'Locating',
        locationStatus: 'locating',
      }

export const buildResolvedLocationState = ({
  useMockLocation,
  deviceLocation,
}: {
  useMockLocation: boolean
  deviceLocation: [number, number] | null
}): ResolvedLocationState => {
  if (useMockLocation) {
    return {
      userLocation: MOCK_LOCATION,
      locationLabel: 'Mock',
      locationStatus: 'mock',
    }
  }

  if (deviceLocation) {
    return {
      userLocation: deviceLocation,
      locationLabel: 'Device',
      locationStatus: 'device',
    }
  }

  return {
    userLocation: null,
    locationLabel: 'Unavailable',
    locationStatus: 'unavailable',
  }
}
