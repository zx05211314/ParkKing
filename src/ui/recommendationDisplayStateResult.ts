import {
  buildRecommendationSelectionState,
  countRecommendationFeedback,
  countRouteAwareRecommendations,
  getBestAddressRecommendationFeedback,
  getBestAddressRecommendationReport,
  getPinnedFavoriteState,
} from './recommendationDisplayCore'
import { buildActiveFilterChips } from './recommendationDisplayFilters'
import { buildNearbySnapshot } from './recommendationDisplaySnapshot'
import {
  getAddressRecommendationEmptyMessage,
  getAddressRecommendationFeedbackLabel,
  getAddressRecommendationRankingLabel,
  getBestAddressRecommendationReason,
  getEmptySegmentsMessage,
  getRecommendationListSortSummary,
} from './recommendationDisplayText'
import type {
  RecommendationTargetLike,
  UseRecommendationDisplayStateOptions,
  UseRecommendationDisplayStateResult,
} from './recommendationDisplayStateTypes'

export const buildRecommendationDisplayState = <
  TTarget extends RecommendationTargetLike,
>({
  filterQuery,
  markedSpacesOnly,
  hideReportedIllegal,
  illegalFeedbackHiddenCount,
  actionFilter,
  actionFilterHiddenCount,
  includeInferred,
  radiusMeters,
  riskMode,
  defaultSegmentActionFilter,
  defaultRadiusMeters,
  defaultRiskMode,
  actionFilterLabels,
  riskModeLabels,
  favoriteAddresses,
  searchAnchor,
  addressRecommendationTargets,
  reportsBySegment,
  routeEtaBySegmentId,
  recommendationRankMode,
  routeEtaStatus,
  routeEtaError,
  searchLocation,
  searchLocationLabel,
  displaySegments,
}: UseRecommendationDisplayStateOptions<TTarget>): UseRecommendationDisplayStateResult<TTarget> => {
  const activeSearchQuery = filterQuery.trim()

  const {
    recommendedSegmentIds,
    bestAddressRecommendationTarget,
    bestAddressRecommendation,
    alternativeAddressRecommendations,
  } = buildRecommendationSelectionState(addressRecommendationTargets)

  const recommendationFeedbackCount = countRecommendationFeedback(
    addressRecommendationTargets,
    reportsBySegment,
  )
  const routeAwareRecommendationCount = countRouteAwareRecommendations(
    addressRecommendationTargets,
    recommendationRankMode,
    routeEtaBySegmentId,
  )

  const addressRecommendationRankingLabel = getAddressRecommendationRankingLabel(
    recommendationRankMode,
    routeAwareRecommendationCount,
    routeEtaError,
  )
  const addressRecommendationFeedbackLabel = getAddressRecommendationFeedbackLabel(
    recommendationFeedbackCount,
  )
  const listSortSummary = getRecommendationListSortSummary(
    searchLocation,
    recommendationRankMode,
    routeEtaStatus,
    routeEtaError,
  )

  const nearbySnapshot = buildNearbySnapshot({
    searchLocation,
    displaySegments,
    recommendationRankMode,
    routeEtaBySegmentId,
  })

  const activeFilterChips = buildActiveFilterChips({
    activeSearchQuery,
    markedSpacesOnly,
    hideReportedIllegal,
    actionFilter,
    includeInferred,
    radiusMeters,
    riskMode,
    defaultSegmentActionFilter,
    defaultRadiusMeters,
    defaultRiskMode,
    actionFilterLabels,
    riskModeLabels,
  })

  const { isPinnedFavorite, pinnedFavoriteRole } = getPinnedFavoriteState(
    favoriteAddresses,
    searchAnchor,
  )
  const bestAddressRecommendationReason = getBestAddressRecommendationReason(
    bestAddressRecommendation,
  )
  const bestAddressRecommendationReport = getBestAddressRecommendationReport(
    bestAddressRecommendation,
    reportsBySegment,
  )
  const bestAddressRecommendationFeedback = getBestAddressRecommendationFeedback(
    bestAddressRecommendationReport,
  )

  const emptySegmentsMessage = getEmptySegmentsMessage({
    activeSearchQuery,
    markedSpacesOnly,
    searchLocationLabel,
    hideReportedIllegal,
    illegalFeedbackHiddenCount,
    actionFilter,
    defaultSegmentActionFilter,
    actionFilterHiddenCount,
  })

  const addressRecommendationEmptyMessage = getAddressRecommendationEmptyMessage({
    activeSearchQuery,
    markedSpacesOnly,
    radiusMeters,
    hideReportedIllegal,
    illegalFeedbackHiddenCount,
    actionFilter,
    defaultSegmentActionFilter,
    actionFilterHiddenCount,
  })

  return {
    activeSearchQuery,
    activeFilterChips,
    hasActiveFilters: activeFilterChips.length > 0,
    recommendedSegmentIds,
    bestAddressRecommendationTarget,
    bestAddressRecommendation,
    alternativeAddressRecommendations,
    addressRecommendationRankingLabel,
    addressRecommendationFeedbackLabel,
    listSortSummary,
    nearbySnapshot,
    isPinnedFavorite,
    pinnedFavoriteRole,
    bestAddressRecommendationReason,
    bestAddressRecommendationReport,
    bestAddressRecommendationFeedback,
    emptySegmentsMessage,
    addressRecommendationEmptyMessage,
  }
}
