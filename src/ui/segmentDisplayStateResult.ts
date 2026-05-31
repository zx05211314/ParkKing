import { filterSegmentsByQuery, getSegmentSearchSuggestions } from './segmentSearch'
import {
  buildActionFilteredSegmentState,
  countIllegalFeedbackHidden,
  filterFeedbackIllegalSegments,
  getSearchableSegments,
} from './segmentDisplayFilters'
import {
  buildRecommendationSortableSegments,
  buildSegmentRecommendationDisplayState,
} from './segmentDisplayRecommendations'
import type {
  RecommendationSortableSegment,
  UseSegmentDisplayStateOptions,
  UseSegmentDisplayStateResult,
} from './segmentDisplayTypes'
import type { SegmentListItem } from './segmentListTypes'

interface BuildSegmentFilterDisplayStateOptions {
  segmentsWithDistance: SegmentListItem[]
  hideReportedIllegal: UseSegmentDisplayStateOptions['hideReportedIllegal']
  reportsBySegment: UseSegmentDisplayStateOptions['reportsBySegment']
  actionFilter: UseSegmentDisplayStateOptions['actionFilter']
  markedSpacesOnly: UseSegmentDisplayStateOptions['markedSpacesOnly']
  deferredFilterQuery: UseSegmentDisplayStateOptions['deferredFilterQuery']
  filterQuery: UseSegmentDisplayStateOptions['filterQuery']
}

interface SegmentFilterDisplayState {
  illegalFeedbackHiddenCount: number
  actionFilterHiddenCount: number
  actionFilteredMarkedSpaceSegmentCount: number
  filteredSegments: SegmentListItem[]
  segmentFilterSuggestions: SegmentListItem[]
  recommendationSortableSegments: RecommendationSortableSegment[]
}

interface BuildSegmentRecommendationDisplayResultOptions
  extends Pick<
      UseSegmentDisplayStateOptions,
      | 'searchLocation'
      | 'recommendationRankMode'
      | 'routeEtaBySegmentId'
      | 'parkingSpaces'
      | 'navigationOrigin'
      | 'selectedParkingSpaceKeyBySegment'
    >,
    Pick<
      SegmentFilterDisplayState,
      'filteredSegments' | 'recommendationSortableSegments'
    > {}

export const buildSegmentFilterDisplayState = ({
  segmentsWithDistance,
  hideReportedIllegal,
  reportsBySegment,
  actionFilter,
  markedSpacesOnly,
  deferredFilterQuery,
  filterQuery,
}: BuildSegmentFilterDisplayStateOptions): SegmentFilterDisplayState => {
  const illegalFeedbackHiddenCount = countIllegalFeedbackHidden(
    segmentsWithDistance,
    hideReportedIllegal,
    reportsBySegment,
  )
  const feedbackFilteredSegments = filterFeedbackIllegalSegments(
    segmentsWithDistance,
    hideReportedIllegal,
    reportsBySegment,
  )
  const {
    actionFilteredSegments,
    actionFilterHiddenCount,
    actionFilteredMarkedSpaceSegmentCount,
  } = buildActionFilteredSegmentState(feedbackFilteredSegments, actionFilter)
  const searchableSegments = getSearchableSegments(
    actionFilteredSegments,
    markedSpacesOnly,
  )
  const filteredSegments = filterSegmentsByQuery(
    searchableSegments,
    deferredFilterQuery,
  )
  const segmentFilterSuggestions = getSegmentSearchSuggestions(
    searchableSegments,
    filterQuery,
  )
  const recommendationSortableSegments = buildRecommendationSortableSegments(
    filteredSegments,
    reportsBySegment,
  )

  return {
    illegalFeedbackHiddenCount,
    actionFilterHiddenCount,
    actionFilteredMarkedSpaceSegmentCount,
    filteredSegments,
    segmentFilterSuggestions,
    recommendationSortableSegments,
  }
}

export const buildSegmentRecommendationDisplayResult = ({
  recommendationSortableSegments,
  filteredSegments,
  searchLocation,
  recommendationRankMode,
  routeEtaBySegmentId,
  parkingSpaces,
  navigationOrigin,
  selectedParkingSpaceKeyBySegment,
}: BuildSegmentRecommendationDisplayResultOptions): Pick<
  UseSegmentDisplayStateResult,
  | 'addressRecommendationCandidates'
  | 'addressRecommendationTargets'
  | 'displaySegments'
  | 'displaySegmentTotalCount'
  | 'displaySegmentLimit'
> =>
  buildSegmentRecommendationDisplayState({
    recommendationSortableSegments,
    filteredSegments,
    searchLocation,
    recommendationRankMode,
    routeEtaBySegmentId,
    parkingSpaces,
    navigationOrigin,
    selectedParkingSpaceKeyBySegment,
  })

export const buildSegmentDisplayStateResult = ({
  segmentsWithDistance,
  segmentFilterState,
  recommendationDisplayState,
}: {
  segmentsWithDistance: UseSegmentDisplayStateResult['segmentsWithDistance']
  segmentFilterState: SegmentFilterDisplayState
  recommendationDisplayState: Pick<
    UseSegmentDisplayStateResult,
    | 'addressRecommendationCandidates'
    | 'addressRecommendationTargets'
    | 'displaySegments'
    | 'displaySegmentTotalCount'
    | 'displaySegmentLimit'
  >
}): UseSegmentDisplayStateResult => ({
  segmentsWithDistance,
  illegalFeedbackHiddenCount: segmentFilterState.illegalFeedbackHiddenCount,
  actionFilterHiddenCount: segmentFilterState.actionFilterHiddenCount,
  actionFilteredMarkedSpaceSegmentCount:
    segmentFilterState.actionFilteredMarkedSpaceSegmentCount,
  filteredSegments: segmentFilterState.filteredSegments,
  segmentFilterSuggestions: segmentFilterState.segmentFilterSuggestions,
  recommendationSortableSegments: segmentFilterState.recommendationSortableSegments,
  addressRecommendationCandidates:
    recommendationDisplayState.addressRecommendationCandidates,
  addressRecommendationTargets: recommendationDisplayState.addressRecommendationTargets,
  displaySegments: recommendationDisplayState.displaySegments,
  displaySegmentTotalCount: recommendationDisplayState.displaySegmentTotalCount,
  displaySegmentLimit: recommendationDisplayState.displaySegmentLimit,
})
