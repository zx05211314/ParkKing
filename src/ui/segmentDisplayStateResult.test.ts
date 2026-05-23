import { describe, expect, it } from 'vitest'
import { rankingGoldenSegments } from '../tests/fixtures/ranking_golden'
import {
  buildSegmentDisplayStateResult,
  buildSegmentFilterDisplayState,
  buildSegmentRecommendationDisplayResult,
} from './segmentDisplayStateResult'

const segmentsWithDistance = rankingGoldenSegments.slice(0, 3).map((segment) => ({
  ...segment,
  distanceMeters: segment.distanceMeters,
}))

describe('segmentDisplayStateResult', () => {
  it('builds the combined segment-display state from filter and recommendation stages', () => {
    const segmentFilterState = buildSegmentFilterDisplayState({
      segmentsWithDistance,
      hideReportedIllegal: false,
      reportsBySegment: {
        [segmentsWithDistance[0].id]: { status: 'LEGAL' },
      },
      actionFilter: 'ALL',
      markedSpacesOnly: false,
      deferredFilterQuery: '',
      filterQuery: 'hydrant',
    })
    const recommendationDisplayState = buildSegmentRecommendationDisplayResult({
      recommendationSortableSegments: segmentFilterState.recommendationSortableSegments,
      filteredSegments: segmentFilterState.filteredSegments,
      searchLocation: [121.56, 25.03],
      recommendationRankMode: 'WALK',
      routeEtaBySegmentId: {
        [segmentsWithDistance[0].id]: {
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

    const result = buildSegmentDisplayStateResult({
      segmentsWithDistance,
      segmentFilterState,
      recommendationDisplayState,
    })

    expect(result.segmentsWithDistance).toHaveLength(3)
    expect(result.filteredSegments).toHaveLength(3)
    expect(result.segmentFilterSuggestions[0]?.id).toBe(segmentsWithDistance[0].id)
    expect(result.recommendationSortableSegments[0]?.reportStatus).toBe('LEGAL')
    expect(result.addressRecommendationCandidates).toHaveLength(3)
    expect(result.addressRecommendationTargets).toHaveLength(3)
    expect(result.displaySegments[0]?.recommendationRank).toBe(1)
  })
})
