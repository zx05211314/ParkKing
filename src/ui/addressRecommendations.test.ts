import { describe, expect, it } from 'vitest'
import {
  getAddressRecommendationCandidates,
  getAddressRecommendationBounds,
  getAddressRecommendations,
} from './addressRecommendations'

describe('getAddressRecommendations', () => {
  it('returns the top ranked segments with stable 1-based ranks', () => {
    const recommendations = getAddressRecommendations([
      { id: 'a', path: [[121.561, 25.033]] },
      { id: 'b', path: [[121.562, 25.034]] },
      { id: 'c', path: [[121.563, 25.035]] },
      { id: 'd', path: [[121.564, 25.036]] },
    ])

    expect(recommendations.map((entry) => entry.rank)).toEqual([1, 2, 3])
    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['a', 'b', 'c'])
  })

  it('reranks candidates by walking ETA when live route data is available', () => {
    const recommendations = getAddressRecommendations(
      [
        { id: 'a', path: [[121.561, 25.033]], rankScore: 5, distanceMeters: 120 },
        { id: 'b', path: [[121.562, 25.034]], rankScore: 4, distanceMeters: 100 },
        { id: 'c', path: [[121.563, 25.035]], rankScore: 3, distanceMeters: 80 },
      ],
      {
        routeEtaBySegmentId: {
          a: {
            walkingDurationSeconds: 420,
            walkingDistanceMeters: 520,
            walkingEstimated: false,
          },
          b: {
            walkingDurationSeconds: 180,
            walkingDistanceMeters: 260,
            walkingEstimated: false,
          },
        },
      },
    )

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a', 'c'])
  })

  it('reranks candidates by driving ETA when drive mode is selected', () => {
    const recommendations = getAddressRecommendations(
      [
        { id: 'a', path: [[121.561, 25.033]], rankScore: 5, distanceMeters: 120 },
        { id: 'b', path: [[121.562, 25.034]], rankScore: 4, distanceMeters: 100 },
      ],
      {
        rankMode: 'DRIVE',
        routeEtaBySegmentId: {
          a: {
            walkingDurationSeconds: 180,
            walkingDistanceMeters: 260,
            walkingEstimated: false,
            drivingDurationSeconds: 240,
            drivingDistanceMeters: 520,
            drivingEstimated: false,
          },
          b: {
            walkingDurationSeconds: 420,
            walkingDistanceMeters: 640,
            walkingEstimated: false,
            drivingDurationSeconds: 120,
            drivingDistanceMeters: 300,
            drivingEstimated: false,
          },
        },
      },
    )

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a'])
  })

  it('sorts by straight-line distance when distance mode is selected', () => {
    const recommendations = getAddressRecommendations(
      [
        {
          id: 'a',
          path: [[121.561, 25.033]],
          rankScore: 9,
          distanceMeters: 160,
          parkingSpaceCount: 8,
        },
        {
          id: 'b',
          path: [[121.562, 25.034]],
          rankScore: 4,
          distanceMeters: 80,
          parkingSpaceCount: 0,
        },
      ],
      {
        rankMode: 'DISTANCE',
      },
    )

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a'])
  })

  it('prefers marked parking spaces when route timing is unavailable', () => {
    const recommendations = getAddressRecommendations([
      {
        id: 'a',
        path: [[121.561, 25.033]],
        rankScore: 9,
        distanceMeters: 120,
        parkingSpaceCount: 0,
      },
      {
        id: 'b',
        path: [[121.562, 25.034]],
        rankScore: 4,
        distanceMeters: 140,
        parkingSpaceCount: 6,
      },
    ])

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a'])
  })

  it('prefers full parking access over temp stop when other signals are tied', () => {
    const recommendations = getAddressRecommendations([
      {
        id: 'a',
        path: [[121.561, 25.033]],
        rankScore: 5,
        distanceMeters: 120,
        parkingSpaceCount: 1,
        allowedNow: 'TEMP_STOP',
      },
      {
        id: 'b',
        path: [[121.562, 25.034]],
        rankScore: 5,
        distanceMeters: 120,
        parkingSpaceCount: 1,
        allowedNow: 'PARK',
      },
    ])

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a'])
  })

  it('hard-demotes segments with local illegal reports', () => {
    const recommendations = getAddressRecommendations([
      {
        id: 'a',
        path: [[121.561, 25.033]],
        rankScore: 9,
        distanceMeters: 60,
        parkingSpaceCount: 4,
        reportStatus: 'ILLEGAL',
      },
      {
        id: 'b',
        path: [[121.562, 25.034]],
        rankScore: 4,
        distanceMeters: 140,
        parkingSpaceCount: 0,
      },
    ])

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a'])
  })

  it('uses local legal reports as a positive tie-breaker', () => {
    const recommendations = getAddressRecommendations([
      {
        id: 'a',
        path: [[121.561, 25.033]],
        rankScore: 5,
        distanceMeters: 120,
        parkingSpaceCount: 1,
      },
      {
        id: 'b',
        path: [[121.562, 25.034]],
        rankScore: 5,
        distanceMeters: 120,
        parkingSpaceCount: 1,
        reportStatus: 'LEGAL',
      },
    ])

    expect(recommendations.map((entry) => entry.segment.id)).toEqual(['b', 'a'])
  })

  it('returns an empty list when the limit is zero', () => {
    expect(
      getAddressRecommendations([{ id: 'a', path: [[121.561, 25.033]] }], {
        limit: 0,
      }),
    ).toEqual([])
  })
})

describe('getAddressRecommendationCandidates', () => {
  it('caps the upstream ETA candidate pool with marked-space priority', () => {
    expect(
      getAddressRecommendationCandidates(
        [
          { id: 'a', path: [[121.561, 25.033]], distanceMeters: 240, parkingSpaceCount: 0 },
          { id: 'b', path: [[121.562, 25.034]], distanceMeters: 120, parkingSpaceCount: 1 },
          { id: 'c', path: [[121.563, 25.035]], distanceMeters: 180, parkingSpaceCount: 4 },
        ],
        2,
      ).map((segment) => segment.id),
    ).toEqual(['c', 'b'])
  })

  it('keeps locally illegal segments behind safer candidates in the ETA pool', () => {
    expect(
      getAddressRecommendationCandidates(
        [
          {
            id: 'a',
            path: [[121.561, 25.033]],
            distanceMeters: 80,
            parkingSpaceCount: 3,
            reportStatus: 'ILLEGAL',
          },
          {
            id: 'b',
            path: [[121.562, 25.034]],
            distanceMeters: 160,
            parkingSpaceCount: 0,
          },
        ],
        2,
      ).map((segment) => segment.id),
    ).toEqual(['b', 'a'])
  })

  it('keeps park-legal candidates ahead of temp-stop candidates in the ETA pool', () => {
    expect(
      getAddressRecommendationCandidates(
        [
          {
            id: 'a',
            path: [[121.561, 25.033]],
            distanceMeters: 120,
            parkingSpaceCount: 1,
            allowedNow: 'TEMP_STOP',
          },
          {
            id: 'b',
            path: [[121.562, 25.034]],
            distanceMeters: 120,
            parkingSpaceCount: 1,
            allowedNow: 'PARK',
          },
        ],
        2,
      ).map((segment) => segment.id),
    ).toEqual(['b', 'a'])
  })
})

describe('getAddressRecommendationBounds', () => {
  it('covers the pinned address and candidate segment geometry', () => {
    const recommendations = getAddressRecommendations([
      {
        id: 'a',
        path: [
          [121.561, 25.033],
          [121.562, 25.034],
        ],
      },
      {
        id: 'b',
        path: [
          [121.565, 25.031],
          [121.566, 25.032],
        ],
      },
    ])

    expect(
      getAddressRecommendationBounds([121.56, 25.035], recommendations),
    ).toEqual([
      [121.56, 25.031],
      [121.566, 25.035],
    ])
  })

  it('returns null without a pinned location or candidates', () => {
    const recommendations = getAddressRecommendations([
      { id: 'a', path: [[121.561, 25.033]] },
    ])

    expect(getAddressRecommendationBounds(null, recommendations)).toBeNull()
    expect(getAddressRecommendationBounds([121.56, 25.035], [])).toBeNull()
  })
})
