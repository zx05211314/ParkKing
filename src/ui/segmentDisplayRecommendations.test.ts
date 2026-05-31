import { describe, expect, it } from 'vitest'
import { rankingGoldenSegments } from '../tests/fixtures/ranking_golden'
import {
  buildRecommendationSortableSegments,
  buildSegmentRecommendationDisplayState,
} from './segmentDisplayRecommendations'
import type { SegmentListItem } from './segmentListTypes'

const filteredSegments: SegmentListItem[] = rankingGoldenSegments.slice(0, 2).map(
  (segment) => ({
    ...segment,
    distanceMeters: segment.distanceMeters,
  }),
)

describe('segmentDisplayRecommendations', () => {
  it('builds sortable segments with report status', () => {
    const sortable = buildRecommendationSortableSegments(filteredSegments, {
      [filteredSegments[0].id]: { status: 'LEGAL' },
    })

    expect(sortable[0]?.reportStatus).toBe('LEGAL')
    expect(sortable[1]?.reportStatus).toBeNull()
  })

  it('builds recommendation targets and decorated display segments', () => {
    const sortable = buildRecommendationSortableSegments(filteredSegments, {})
    const state = buildSegmentRecommendationDisplayState({
      recommendationSortableSegments: sortable,
      filteredSegments,
      searchLocation: [121.56, 25.03],
      recommendationRankMode: 'WALK',
      routeEtaBySegmentId: {
        [filteredSegments[0].id]: {
          walkingDistanceMeters: 120,
          walkingDurationSeconds: 90,
          walkingEstimated: false,
          drivingDistanceMeters: 300,
          drivingDurationSeconds: 120,
          drivingEstimated: false,
        },
      },
      parkingSpaces: {
        type: 'FeatureCollection',
        features: [],
      },
      navigationOrigin: [121.56, 25.03],
      selectedParkingSpaceKeyBySegment: {},
    })

    expect(state.addressRecommendationCandidates).toHaveLength(2)
    expect(state.addressRecommendationTargets).toHaveLength(2)
    expect(state.displaySegments[0]?.recommendationRank).toBe(1)
    expect(state.displaySegments[0]?.recommendedTargetLabel).toBeTruthy()
    expect(state.displaySegments[0]?.quickActionNavigationLinks?.walking).toContain(
      'google.com/maps',
    )
  })

  it('caps display segments while preserving the uncapped total count', () => {
    const manySegments = Array.from({ length: 510 }, (_, index) => ({
      ...filteredSegments[0],
      id: `segment-${index}`,
      name: `Segment ${index}`,
    }))
    const state = buildSegmentRecommendationDisplayState({
      recommendationSortableSegments: buildRecommendationSortableSegments(
        manySegments,
        {},
      ),
      filteredSegments: manySegments,
      searchLocation: null,
      recommendationRankMode: 'WALK',
      routeEtaBySegmentId: {},
      parkingSpaces: {
        type: 'FeatureCollection',
        features: [],
      },
      navigationOrigin: null,
      selectedParkingSpaceKeyBySegment: {},
    })

    expect(state.displaySegments).toHaveLength(500)
    expect(state.displaySegmentTotalCount).toBe(510)
    expect(state.displaySegmentLimit).toBe(500)
  })

  it('caps ranked display segments before recommendation decoration', () => {
    const manySegments = Array.from({ length: 510 }, (_, index) => ({
      ...filteredSegments[0],
      id: `ranked-segment-${index}`,
      name: `Ranked segment ${index}`,
    }))
    const state = buildSegmentRecommendationDisplayState({
      recommendationSortableSegments: buildRecommendationSortableSegments(
        manySegments,
        {},
      ),
      filteredSegments: manySegments,
      searchLocation: [121.56, 25.03],
      recommendationRankMode: 'WALK',
      routeEtaBySegmentId: {},
      parkingSpaces: {
        type: 'FeatureCollection',
        features: [],
      },
      navigationOrigin: [121.56, 25.03],
      selectedParkingSpaceKeyBySegment: {},
    })

    expect(state.displaySegments).toHaveLength(500)
    expect(state.displaySegmentTotalCount).toBe(510)
    expect(state.displaySegmentLimit).toBe(500)
  })
})
