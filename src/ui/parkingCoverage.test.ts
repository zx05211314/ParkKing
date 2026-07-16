import { describe, expect, it } from 'vitest'
import {
  buildParkingCoverageState,
  isLocationWithinBounds,
} from './parkingCoverage'

const bounds: [[number, number], [number, number]] = [
  [121.5, 25],
  [121.6, 25.1],
]

describe('parkingCoverage', () => {
  it('accepts locations inside or on the active dataset bounds', () => {
    expect(isLocationWithinBounds([121.55, 25.05], bounds)).toBe(true)
    expect(isLocationWithinBounds([121.5, 25], bounds)).toBe(true)
    expect(
      buildParkingCoverageState({
        location: [121.55, 25.05],
        districtBounds: bounds,
        districtName: 'Xinyi',
      }),
    ).toEqual({
      eligibleLocation: [121.55, 25.05],
      notice: null,
    })
  })

  it('blocks parking evaluation outside the active dataset bounds', () => {
    const state = buildParkingCoverageState({
      location: [121.51, 25.12],
      districtBounds: bounds,
      districtName: 'Xinyi',
    })

    expect(state.eligibleLocation).toBeNull()
    expect(state.notice).toContain('outside the active Xinyi dataset')
    expect(state.notice).toContain('did not calculate a parking legality answer')
  })

  it('does not claim a coverage failure when dataset bounds are unavailable', () => {
    expect(
      buildParkingCoverageState({
        location: [121.51, 25.12],
        districtBounds: null,
        districtName: 'Unknown',
      }),
    ).toEqual({
      eligibleLocation: [121.51, 25.12],
      notice: null,
    })
  })
})
