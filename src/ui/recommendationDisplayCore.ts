import { normalizeReportSegmentId, type SegmentReport } from '../feedback/reports'
import { formatSegmentFeedbackSummary } from './feedbackSummary'
import type { GeocodeResult } from '../map/geocoder'
import {
  findFavoriteAddress,
  type FavoriteAddress,
  type FavoriteAddressRole,
} from './recentAddresses'
import type { AddressRecommendationRankMode } from './addressRecommendations'

interface SearchAnchorLike<TResult> {
  result: TResult
}

interface SegmentWithId {
  id: string
}

interface RecommendationTargetLike<TSegment extends SegmentWithId> {
  segment: TSegment
}

interface RouteEtaLike {
  walkingDurationSeconds: number | null
  drivingDurationSeconds: number | null
}

interface RecommendationSelectionState<TTarget extends RecommendationTargetLike<SegmentWithId>> {
  recommendedSegmentIds: string[]
  bestAddressRecommendationTarget: TTarget | null
  bestAddressRecommendation: TTarget['segment'] | null
  alternativeAddressRecommendations: TTarget[]
}

export const buildRecommendationSelectionState = <
  TTarget extends RecommendationTargetLike<SegmentWithId>,
>(
  addressRecommendationTargets: TTarget[],
): RecommendationSelectionState<TTarget> => {
  const recommendedSegmentIds = addressRecommendationTargets.map(
    ({ segment }) => segment.id,
  )
  const bestAddressRecommendationTarget = addressRecommendationTargets[0] ?? null
  const bestAddressRecommendation = bestAddressRecommendationTarget?.segment ?? null
  const alternativeAddressRecommendations = addressRecommendationTargets.slice(1)

  return {
    recommendedSegmentIds,
    bestAddressRecommendationTarget,
    bestAddressRecommendation,
    alternativeAddressRecommendations,
  }
}

export const countRecommendationFeedback = <
  TTarget extends RecommendationTargetLike<SegmentWithId>,
>(
  addressRecommendationTargets: TTarget[],
  reportsBySegment: Record<string, SegmentReport>,
) =>
  addressRecommendationTargets.filter(
    ({ segment }) => reportsBySegment[normalizeReportSegmentId(segment.id)],
  ).length

export const countRouteAwareRecommendations = <
  TTarget extends RecommendationTargetLike<SegmentWithId>,
>(
  addressRecommendationTargets: TTarget[],
  recommendationRankMode: AddressRecommendationRankMode,
  routeEtaBySegmentId: Record<string, RouteEtaLike>,
) =>
  addressRecommendationTargets.filter(({ segment }) => {
    const routeEta = routeEtaBySegmentId[segment.id]
    const relevantDuration =
      recommendationRankMode === 'WALK'
        ? routeEta?.walkingDurationSeconds
        : recommendationRankMode === 'DRIVE'
          ? routeEta?.drivingDurationSeconds
          : null
    return relevantDuration !== null && relevantDuration !== undefined
  }).length

export const getPinnedFavoriteState = <TResult extends GeocodeResult>(
  favoriteAddresses: FavoriteAddress[],
  searchAnchor: SearchAnchorLike<TResult> | null,
): {
  isPinnedFavorite: boolean
  pinnedFavoriteRole: FavoriteAddressRole | null
} => {
  const pinnedFavoriteAddress = findFavoriteAddress(
    favoriteAddresses,
    searchAnchor?.result ?? null,
  )

  return {
    isPinnedFavorite: pinnedFavoriteAddress !== null,
    pinnedFavoriteRole: pinnedFavoriteAddress?.role ?? null,
  }
}

export const getBestAddressRecommendationReport = (
  bestAddressRecommendation: SegmentWithId | null,
  reportsBySegment: Record<string, SegmentReport>,
) =>
  bestAddressRecommendation
    ? reportsBySegment[normalizeReportSegmentId(bestAddressRecommendation.id)] ?? null
    : null

export const getBestAddressRecommendationFeedback = (
  bestAddressRecommendationReport: SegmentReport | null,
) => formatSegmentFeedbackSummary(bestAddressRecommendationReport)
