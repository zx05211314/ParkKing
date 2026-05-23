import { describe, expect, it } from 'vitest'
import type { ParkingSpaceMatch } from '../data/parkingSpaces'
import {
  buildSelectedParkingTargetDisplayState,
  getSelectedParkingSpaceKey,
  getVisibleSelectedParkingSpaceMatches,
} from './selectedParkingTargetState'

const selectedSegment = {
  id: 'seg-1',
  path: [
    [121.565, 25.033],
    [121.5654, 25.033],
  ] as [number, number][],
}

const parkingSpaceMatches: ParkingSpaceMatch[] = [
  {
    key: 'space-a',
    anchor: [121.5651, 25.033],
    distanceToSegmentMeters: 1,
    distanceToReferenceMeters: 40,
    properties: { label: 'Space A' },
  },
  {
    key: 'space-b',
    anchor: [121.5652, 25.033],
    distanceToSegmentMeters: 1,
    distanceToReferenceMeters: 60,
    properties: { label: 'Space B' },
  },
  {
    key: 'space-c',
    anchor: [121.5653, 25.033],
    distanceToSegmentMeters: 1,
    distanceToReferenceMeters: 80,
    properties: { label: 'Space C' },
  },
]

describe('selectedParkingTargetState', () => {
  it('keeps the manual parking-space selection visible when truncating options', () => {
    expect(
      getSelectedParkingSpaceKey(selectedSegment, { 'seg-1': 'space-b' }),
    ).toBe('space-b')
    expect(
      getVisibleSelectedParkingSpaceMatches(parkingSpaceMatches, parkingSpaceMatches[1], 2),
    ).toEqual([parkingSpaceMatches[1], parkingSpaceMatches[0]])
  })

  it('builds selected-space options and recommendation markers', () => {
    const result = buildSelectedParkingTargetDisplayState({
      selectedSegment,
      selectedParkingSpaceKey: 'space-b',
      selectedParkingSpaceMatches: parkingSpaceMatches,
      navigationOrigin: [121.565, 25.033],
      maxSelectedParkingSpaceOptions: 2,
      addressRecommendationTargets: [
        {
          rank: 1,
          targetKind: 'PARKING_SPACE',
          targetKey: 'other-space',
          destination: [121.566, 25.034],
          segment: { id: 'seg-2' },
        },
        {
          rank: 2,
          targetKind: 'PARKING_SPACE',
          targetKey: 'selected-space',
          destination: [121.567, 25.035],
          segment: { id: 'seg-1' },
        },
        {
          rank: 3,
          targetKind: 'SEGMENT',
          targetKey: null,
          destination: [121.568, 25.036],
          segment: { id: 'seg-3' },
        },
      ],
      selectedId: 'seg-1',
    })

    expect(result.selectedParkingSpaceMatch?.key).toBe('space-b')
    expect(result.selectedParkingSpaceTargetMode).toBe('MANUAL')
    expect(result.selectedParkingSpaceOptions.map((option) => option.key)).toEqual([
      'space-b',
      'space-a',
    ])
    expect(result.selectedParkingSpaceOptions.find((option) => option.key === 'space-b'))
      .toMatchObject({
        label: 'Space B',
        active: true,
      })
    expect(result.selectedParkingSpaceMapMarkers).toEqual([
      {
        key: 'space-b',
        anchor: [121.5652, 25.033],
        shortLabel: 'B',
        active: true,
      },
      {
        key: 'space-a',
        anchor: [121.5651, 25.033],
        shortLabel: 'A',
        active: false,
      },
    ])
    expect(result.recommendedParkingTargetMarkers).toEqual([
      {
        key: 'recommendation-target:seg-2:other-space',
        segmentId: 'seg-2',
        targetKey: 'other-space',
        anchor: [121.566, 25.034],
        shortLabel: '1',
        active: false,
      },
    ])
  })
})
