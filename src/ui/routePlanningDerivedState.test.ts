import { describe, expect, it } from 'vitest'
import {
  buildBestAddressRecommendationRouteDisplayState,
  buildRouteTargetSegments,
  buildSelectedRoutePlanningDisplayState,
} from './routePlanningDerivedState'

describe('routePlanningDerivedState', () => {
  it('dedupes route target segments while keeping the selected segment first', () => {
    const result = buildRouteTargetSegments({
      selectedSegment: { id: 'seg-3', path: [] },
      recommendationSortableSegments: [
        { id: 'seg-1', path: [] },
        { id: 'seg-2', path: [] },
        { id: 'seg-3', path: [] },
      ],
      addressRecommendationCandidates: [
        { id: 'seg-2', path: [] },
        { id: 'seg-4', path: [] },
      ],
      maxListRouteTargets: 2,
    })

    expect(result.map((segment) => segment.id)).toEqual([
      'seg-3',
      'seg-1',
      'seg-2',
      'seg-4',
    ])
  })

  it('builds selected route display state with the parking-space label override', () => {
    const result = buildSelectedRoutePlanningDisplayState({
      navigationOrigin: [121.56, 25.03],
      resolveSegmentArrivalTarget: () => ({
        destination: [121.565, 25.033],
        label: 'Marked space',
        description: 'Marked parking space near the east end',
        hint: 'Arrive at the marked parking space.',
        kind: 'PARKING_SPACE',
      }),
      selectedParkingSpaceMatch: {
        key: 'space-1',
        anchor: [121.565, 25.033],
        distanceToSegmentMeters: 1,
        distanceToReferenceMeters: 5,
        properties: null,
      },
      selectedParkingSpaceOptions: [
        {
          key: 'space-1',
          label: 'Marked space #1',
          description: 'Nearest marked space',
          distanceMeters: 5,
          active: true,
        },
      ],
      selectedSegment: {
        id: 'seg-1',
        path: [
          [121.564, 25.033],
          [121.566, 25.033],
        ],
      },
      selectedTargetRouteEta: {
        walkingDistanceMeters: 120,
        walkingDurationSeconds: 90,
        walkingEstimated: false,
        drivingDistanceMeters: 250,
        drivingDurationSeconds: 55,
        drivingEstimated: true,
      },
    })

    expect(result.selectedArrivalLabel).toBe('Marked space #1')
    expect(result.selectedArrivalKind).toBe('PARKING_SPACE')
    expect(result.selectedRouteEta?.walkingDurationSeconds).toBe(90)
    expect(result.selectedNavigationLinks?.walking).toContain('travelmode=walking')
    expect(result.selectedWalkDistance).not.toBeNull()
  })

  it('builds best-recommendation route display state from the target and ETA map', () => {
    const result = buildBestAddressRecommendationRouteDisplayState({
      bestAddressRecommendation: {
        id: 'seg-2',
        path: [],
      },
      bestAddressRecommendationTarget: {
        destination: [121.567, 25.034],
        description: 'Marked parking space near the north end',
        targetKind: 'PARKING_SPACE',
        walkDistanceMeters: 42,
      },
      navigationOrigin: [121.56, 25.03],
      routeEtaBySegmentId: {
        'seg-2': {
          walkingDistanceMeters: 120,
          walkingDurationSeconds: 90,
          walkingEstimated: false,
          drivingDistanceMeters: 250,
          drivingDurationSeconds: 55,
          drivingEstimated: true,
        },
      },
    })

    expect(result.bestAddressRecommendationArrivalKind).toBe('PARKING_SPACE')
    expect(result.bestAddressRecommendationArrivalHint).toBe(
      'Marked parking space near the north end',
    )
    expect(result.bestAddressRecommendationWalkDistance).toBe(42)
    expect(result.bestAddressRecommendationRouteEta?.drivingDurationSeconds).toBe(55)
    expect(result.bestAddressRecommendationNavigationLinks?.driving).toContain(
      'travelmode=driving',
    )
  })
})
