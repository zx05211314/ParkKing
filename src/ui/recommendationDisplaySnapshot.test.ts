import { describe, expect, it } from 'vitest'
import { buildNearbySnapshot } from './recommendationDisplaySnapshot'

describe('buildNearbySnapshot', () => {
  it('counts allowed actions, marked spaces, and route-ready segments', () => {
    const snapshot = buildNearbySnapshot({
      searchLocation: [121.5, 25.0],
      displaySegments: [
        { id: 'a', allowedNow: 'PARK', parkingSpaceCount: 2 },
        { id: 'b', allowedNow: 'TEMP_STOP', parkingSpaceCount: 0 },
        { id: 'c', allowedNow: 'NO_STOP', parkingSpaceCount: 1 },
      ],
      recommendationRankMode: 'WALK',
      routeEtaBySegmentId: {
        a: {
          walkingDistanceMeters: 120,
          walkingDurationSeconds: 90,
          walkingEstimated: false,
          drivingDistanceMeters: null,
          drivingDurationSeconds: null,
          drivingEstimated: false,
        },
        b: {
          walkingDistanceMeters: null,
          walkingDurationSeconds: null,
          walkingEstimated: false,
          drivingDistanceMeters: 200,
          drivingDurationSeconds: 60,
          drivingEstimated: false,
        },
      },
    })

    expect(snapshot).toEqual({
      total: 3,
      parkCount: 1,
      stopCount: 1,
      noStopCount: 1,
      markedSpaceCount: 2,
      etaReadyCount: 1,
    })
  })

  it('returns null without a pinned search location', () => {
    expect(
      buildNearbySnapshot({
        searchLocation: null,
        displaySegments: [{ id: 'a', allowedNow: 'PARK', parkingSpaceCount: 1 }],
        recommendationRankMode: 'DISTANCE',
        routeEtaBySegmentId: {},
      }),
    ).toBeNull()
  })
})
