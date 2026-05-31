import { describe, expect, it } from 'vitest'
import { buildAppDerivedNavigationState } from './appDerivedNavigationState'

describe('appDerivedNavigationState', () => {
  it('prefers the pinned location for navigation and distance state', () => {
    const result = buildAppDerivedNavigationState({
      locationLabel: 'Current',
      searchAnchor: {
        result: {
          id: 'place-1',
          label: 'City Hall',
          center: [121.5645, 25.0332],
          bounds: null,
        },
      },
      selectedId: 'seg-1',
      selectedParkingSpaceKeyBySegment: {
        'seg-1': 'space-1',
      },
      userLocation: [121.55, 25.02],
    })

    expect(result.searchLocation).toEqual([121.5645, 25.0332])
    expect(result.searchLocationLabel).toBe('City Hall')
    expect(result.navigationOrigin).toEqual([121.5645, 25.0332])
    expect(result.navigationSourceLabel).toBe('Pinned location: City Hall')
    expect(result.activeDistanceLabel).toBe('City Hall')
    expect(result.selectedParkingShareKey).toBe('space-1')
  })

  it('falls back to the user location when there is no pinned location', () => {
    const result = buildAppDerivedNavigationState({
      locationLabel: 'Current',
      searchAnchor: null,
      selectedId: null,
      selectedParkingSpaceKeyBySegment: {},
      userLocation: [121.55, 25.02],
    })

    expect(result.searchLocation).toBeNull()
    expect(result.navigationOrigin).toEqual([121.55, 25.02])
    expect(result.navigationSourceLabel).toBe('Current location')
    expect(result.activeDistanceLabel).toBe('Current')
    expect(result.selectedParkingShareKey).toBeNull()
  })

  it('keeps navigation empty when device location is unavailable', () => {
    const result = buildAppDerivedNavigationState({
      locationLabel: 'Unavailable',
      searchAnchor: null,
      selectedId: null,
      selectedParkingSpaceKeyBySegment: {},
      userLocation: null,
    })

    expect(result.searchLocation).toBeNull()
    expect(result.navigationOrigin).toBeNull()
    expect(result.navigationSourceLabel).toBeNull()
    expect(result.activeDistanceLabel).toBe('Unavailable')
    expect(result.selectedParkingShareKey).toBeNull()
  })
})
