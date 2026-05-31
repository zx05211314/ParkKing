import { isRoutingAvailabilityMessage } from '../map/routing'
import { reasonText } from '../domain/reasons/reasonText'
import type { ReasonCode } from '../domain/reasons/reasonCodes'
import { getParkingSpaceBackedReason } from './parkingEvidencePresentation'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SegmentActionFilter } from './segmentActionFilter'

interface RecommendationReasonLike {
  allowedNow?: 'PARK' | 'TEMP_STOP' | 'NO_STOP' | null
  dataFreshnessDays?: number | null
  tier?: 'GREEN' | 'YELLOW' | 'RED' | null
  sourceType?: 'CURB' | 'INFERRED' | null
  parkingSpaceCount?: number | null
  reasonCodes?: ReasonCode[]
  reasons?: string[]
}

type RouteEtaStatus = 'idle' | 'loading' | 'ready' | 'error'

interface BuildEmptyMessageOptions {
  activeSearchQuery: string
  markedSpacesOnly: boolean
  searchLocationLabel: string | null
  radiusMeters: number
  hideReportedIllegal: boolean
  illegalFeedbackHiddenCount: number
  actionFilter: SegmentActionFilter
  defaultSegmentActionFilter: SegmentActionFilter
  actionFilterHiddenCount: number
}

const buildFilterNotes = ({
  hideReportedIllegal,
  illegalFeedbackHiddenCount,
  actionFilter,
  defaultSegmentActionFilter,
  actionFilterHiddenCount,
}: Pick<
  BuildEmptyMessageOptions,
  | 'hideReportedIllegal'
  | 'illegalFeedbackHiddenCount'
  | 'actionFilter'
  | 'defaultSegmentActionFilter'
  | 'actionFilterHiddenCount'
>) => {
  const illegalFeedbackFilterNote =
    hideReportedIllegal && illegalFeedbackHiddenCount > 0
      ? ` Locally flagged illegal segments are hidden (${illegalFeedbackHiddenCount}).`
      : ''
  const actionFilterNote =
    actionFilter !== defaultSegmentActionFilter && actionFilterHiddenCount > 0
      ? ` ${actionFilter === 'PARK_ONLY' ? 'Only park-legal segments are shown' : 'Hard no-stop segments are hidden'} (${actionFilterHiddenCount}).`
      : ''

  return { illegalFeedbackFilterNote, actionFilterNote }
}

export const getAddressRecommendationRankingLabel = (
  recommendationRankMode: AddressRecommendationRankMode,
  routeAwareRecommendationCount: number,
  routeEtaError: string | null = null,
) => {
  if (isRoutingAvailabilityMessage(routeEtaError)) {
    return recommendationRankMode === 'WALK'
      ? 'Live walk ETA unavailable on this deployment. Ranking falls back to target distance with marked-space support'
      : recommendationRankMode === 'DRIVE'
        ? 'Live drive ETA unavailable on this deployment. Ranking falls back to target distance with marked-space support'
        : 'Ranked by distance to exact targets, then marked spaces'
  }

  return recommendationRankMode === 'WALK'
    ? routeAwareRecommendationCount > 0
      ? 'Ranked by walk ETA to exact targets, then marked spaces'
      : 'Ranked by walk ETA to exact targets with marked-space fallback'
    : recommendationRankMode === 'DRIVE'
      ? routeAwareRecommendationCount > 0
        ? 'Ranked by drive ETA to exact targets, then marked spaces'
        : 'Ranked by drive ETA to exact targets with marked-space fallback'
      : 'Ranked by distance to exact targets, then marked spaces'
}

export const getAddressRecommendationFeedbackLabel = (
  recommendationFeedbackCount: number,
) =>
  recommendationFeedbackCount > 0
    ? `Local feedback is adjusting ${recommendationFeedbackCount} nearby option${recommendationFeedbackCount === 1 ? '' : 's'}.`
    : null

export const getRecommendationListSortSummary = (
  searchLocation: [number, number] | null,
  recommendationRankMode: AddressRecommendationRankMode,
  routeEtaStatus: RouteEtaStatus,
  routeEtaError: string | null = null,
) => {
  if (!searchLocation) {
    return null
  }

  if (isRoutingAvailabilityMessage(routeEtaError)) {
    return recommendationRankMode === 'WALK'
      ? 'List sorted by target distance while live walk ETA is unavailable on this deployment.'
      : recommendationRankMode === 'DRIVE'
        ? 'List sorted by target distance while live drive ETA is unavailable on this deployment.'
        : 'List sorted by target distance, then parking access.'
  }

  return recommendationRankMode === 'WALK'
    ? routeEtaStatus === 'loading'
      ? 'List sorted by walk ETA when available. Live ETA is still loading.'
      : 'List sorted by walk ETA when available.'
    : recommendationRankMode === 'DRIVE'
      ? routeEtaStatus === 'loading'
        ? 'List sorted by drive ETA when available. Live ETA is still loading.'
        : 'List sorted by drive ETA when available.'
      : 'List sorted by target distance, then parking access.'
}

export const getBestAddressRecommendationReason = (
  bestAddressRecommendation: RecommendationReasonLike | null,
) => {
  if (!bestAddressRecommendation) {
    return null
  }

  const parkingEvidenceReason = getParkingSpaceBackedReason(bestAddressRecommendation)
  if (parkingEvidenceReason) {
    return parkingEvidenceReason
  }

  const primaryReasonCode = bestAddressRecommendation.reasonCodes?.[0]
  if (primaryReasonCode) {
    return reasonText(primaryReasonCode)
  }

  return bestAddressRecommendation.reasons?.[0] ?? null
}

export const getEmptySegmentsMessage = ({
  activeSearchQuery,
  markedSpacesOnly,
  searchLocationLabel,
  hideReportedIllegal,
  illegalFeedbackHiddenCount,
  actionFilter,
  defaultSegmentActionFilter,
  actionFilterHiddenCount,
}: Omit<BuildEmptyMessageOptions, 'radiusMeters'>) => {
  const { illegalFeedbackFilterNote, actionFilterNote } = buildFilterNotes({
    hideReportedIllegal,
    illegalFeedbackHiddenCount,
    actionFilter,
    defaultSegmentActionFilter,
    actionFilterHiddenCount,
  })

  return activeSearchQuery
    ? markedSpacesOnly
      ? `No marked-space segments match "${activeSearchQuery}".${illegalFeedbackFilterNote}${actionFilterNote}`
      : `No segments match "${activeSearchQuery}".${illegalFeedbackFilterNote}${actionFilterNote}`
    : searchLocationLabel
      ? markedSpacesOnly
        ? `No nearby segments with marked spaces found around "${searchLocationLabel}".${illegalFeedbackFilterNote}${actionFilterNote}`
        : `No nearby segments found around "${searchLocationLabel}".${illegalFeedbackFilterNote}${actionFilterNote}`
      : `No segments available.${illegalFeedbackFilterNote}${actionFilterNote}`
}

export const getAddressRecommendationEmptyMessage = ({
  activeSearchQuery,
  markedSpacesOnly,
  radiusMeters,
  hideReportedIllegal,
  illegalFeedbackHiddenCount,
  actionFilter,
  defaultSegmentActionFilter,
  actionFilterHiddenCount,
}: Omit<BuildEmptyMessageOptions, 'searchLocationLabel'>) => {
  const { illegalFeedbackFilterNote, actionFilterNote } = buildFilterNotes({
    hideReportedIllegal,
    illegalFeedbackHiddenCount,
    actionFilter,
    defaultSegmentActionFilter,
    actionFilterHiddenCount,
  })

  return activeSearchQuery
    ? markedSpacesOnly
      ? `No marked-space candidates match "${activeSearchQuery}".${illegalFeedbackFilterNote}${actionFilterNote}`
      : `No pinned-location candidates match "${activeSearchQuery}".${illegalFeedbackFilterNote}${actionFilterNote}`
    : markedSpacesOnly
      ? `No ranked marked-space segments found within ${radiusMeters} m of this location.${illegalFeedbackFilterNote}${actionFilterNote}`
      : `No ranked segments found within ${radiusMeters} m of this location.${illegalFeedbackFilterNote}${actionFilterNote}`
}
