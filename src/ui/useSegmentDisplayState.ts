import { useMemo } from 'react'
import {
  buildSegmentsWithDistance,
} from './segmentDisplayFilters'
import {
  buildSegmentDisplayStateResult,
  buildSegmentFilterDisplayState,
  buildSegmentRecommendationDisplayResult,
} from './segmentDisplayStateResult'
import type {
  UseSegmentDisplayStateOptions,
  UseSegmentDisplayStateResult,
} from './segmentDisplayTypes'

export const useSegmentDisplayState = ({
  evaluatedSegments,
  activeDistanceLocation,
  includeInferred,
  radiusMeters,
  riskMode,
  hideReportedIllegal,
  reportsBySegment,
  actionFilter,
  markedSpacesOnly,
  deferredFilterQuery,
  filterQuery,
  searchLocation,
  recommendationRankMode,
  routeEtaBySegmentId,
  parkingSpaces,
  navigationOrigin,
  selectedParkingSpaceKeyBySegment,
}: UseSegmentDisplayStateOptions): UseSegmentDisplayStateResult => {
  const segmentsWithDistance = useMemo(
    () =>
      buildSegmentsWithDistance(
        evaluatedSegments,
        activeDistanceLocation,
        includeInferred,
        radiusMeters,
        riskMode,
      ),
    [
      activeDistanceLocation,
      evaluatedSegments,
      includeInferred,
      radiusMeters,
      riskMode,
    ],
  )

  const segmentFilterState = useMemo(
    () =>
      buildSegmentFilterDisplayState({
        segmentsWithDistance,
        hideReportedIllegal,
        reportsBySegment,
        actionFilter,
        markedSpacesOnly,
        deferredFilterQuery,
        filterQuery,
      }),
    [
      actionFilter,
      deferredFilterQuery,
      filterQuery,
      hideReportedIllegal,
      markedSpacesOnly,
      reportsBySegment,
      segmentsWithDistance,
    ],
  )

  const recommendationDisplayState = useMemo(
    () =>
      buildSegmentRecommendationDisplayResult({
        recommendationSortableSegments:
          segmentFilterState.recommendationSortableSegments,
        filteredSegments: segmentFilterState.filteredSegments,
        searchLocation,
        recommendationRankMode,
        routeEtaBySegmentId,
        parkingSpaces,
        navigationOrigin,
        selectedParkingSpaceKeyBySegment,
      }),
    [
      navigationOrigin,
      parkingSpaces,
      recommendationRankMode,
      routeEtaBySegmentId,
      searchLocation,
      selectedParkingSpaceKeyBySegment,
      segmentFilterState.filteredSegments,
      segmentFilterState.recommendationSortableSegments,
    ],
  )

  return buildSegmentDisplayStateResult({
    segmentsWithDistance,
    segmentFilterState,
    recommendationDisplayState,
  })
}

export type {
  RouteEtaLike,
  UseSegmentDisplayStateOptions,
  UseSegmentDisplayStateResult,
} from './segmentDisplayTypes'
