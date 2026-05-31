import { describe, expect, it } from 'vitest'
import {
  buildNavigationLinks,
  buildNavigationUrl,
  estimateWalkDistanceMeters,
  getSegmentArrivalTarget,
  getSegmentDestination,
} from './navigation'

describe('estimateWalkDistanceMeters', () => {
  it('inflates straight-line distance to approximate walking access', () => {
    expect(
      estimateWalkDistanceMeters([121.5645, 25.0338], [121.566, 25.035]),
    ).toBeGreaterThan(0)
  })

  it('returns null without both endpoints', () => {
    expect(estimateWalkDistanceMeters(null, [121.566, 25.035])).toBeNull()
    expect(estimateWalkDistanceMeters([121.5645, 25.0338], null)).toBeNull()
  })
})

describe('getSegmentArrivalTarget', () => {
  it('selects the nearest segment end and returns an arrival hint', () => {
    expect(
      getSegmentArrivalTarget(
        [
          [121.564, 25.033],
          [121.566, 25.035],
        ],
        [121.5638, 25.0328],
      ),
    ).toEqual({
      destination: [121.564, 25.033],
      label: 'West end',
      description: 'West end of this curb segment',
      hint: 'Arrive near the west end of this curb segment.',
      kind: 'SEGMENT',
    })
  })

  it('falls back to a mid-segment target when no origin is available', () => {
    expect(
      getSegmentArrivalTarget([
        [121.564, 25.033],
        [121.566, 25.035],
      ]),
    ).toEqual({
      destination: [121.565, 25.034],
      label: 'Mid-segment',
      description: 'Middle of this curb segment',
      hint: 'Arrive near the middle of this curb segment.',
      kind: 'SEGMENT',
    })
  })

  it('prefers a marked parking space destination when one is provided', () => {
    expect(
      getSegmentArrivalTarget(
        [
          [121.564, 25.033],
          [121.566, 25.035],
        ],
        [121.5638, 25.0328],
        [121.5643, 25.0333],
      ),
    ).toEqual({
      destination: [121.5643, 25.0333],
      label: 'Marked space',
      description: 'Marked parking space near the west end of this curb segment',
      hint: 'Arrive at the marked parking space near the west end of this curb segment.',
      kind: 'PARKING_SPACE',
    })
  })
})

describe('getSegmentDestination', () => {
  it('returns the selected arrival target point', () => {
    expect(
      getSegmentDestination(
        [
          [121.564, 25.033],
          [121.566, 25.035],
        ],
        [121.5662, 25.0352],
        [121.5656, 25.0347],
      ),
    ).toEqual([121.5656, 25.0347])
  })
})

describe('buildNavigationUrl', () => {
  it('builds a google maps directions url with origin and travel mode', () => {
    expect(
      buildNavigationUrl([121.565, 25.034], {
        mode: 'walking',
        origin: [121.564, 25.033],
      }),
    ).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=25.034%2C121.565&travelmode=walking&dir_action=navigate&origin=25.033%2C121.564',
    )
  })
})

describe('buildNavigationLinks', () => {
  it('builds both walking and driving links when a destination exists', () => {
    expect(buildNavigationLinks([121.565, 25.034], [121.564, 25.033])).toEqual({
      walking:
        'https://www.google.com/maps/dir/?api=1&destination=25.034%2C121.565&travelmode=walking&dir_action=navigate&origin=25.033%2C121.564',
      driving:
        'https://www.google.com/maps/dir/?api=1&destination=25.034%2C121.565&travelmode=driving&dir_action=navigate&origin=25.033%2C121.564',
    })
  })
})
