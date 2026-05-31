import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import { buildSavedPlanEntry, type SavedPlanRouteEtaSummary } from './savedPlanShareModel'
import type {
  SavedPlanSelectionOptions,
  SavedPlanShareSegment,
  SavedPlanShareTarget,
} from './savedPlanSaveTypes'
import type { SavedPlan } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './shareState'
import type { SegmentListItem } from './segmentListTypes'

interface BuildSavedPlanSelectionStateOptions {
  actionFilter: SegmentActionFilter
  buildShareUrlForState: (overrides: Partial<SharedAppState>) => string | null
  datasetId: string | null
  mode: TimeMode
  radiusMeters: number
  recommendationRankMode: AddressRecommendationRankMode
  riskMode: RiskMode
  savedPlans: SavedPlan[]
  searchLocationLabel: string | null
  selectedRouteProfile: RouteProfile
  selection: SavedPlanSelectionOptions
}

export interface SavedPlanSelectionStateResult {
  existingPlan: SavedPlan | null
  nextPlan: Omit<SavedPlan, 'key'>
  successMessage: string
  url: string
}

export const buildSavedPlanSelectionState = ({
  actionFilter,
  buildShareUrlForState,
  datasetId,
  mode,
  radiusMeters,
  recommendationRankMode,
  riskMode,
  savedPlans,
  searchLocationLabel,
  selectedRouteProfile,
  selection,
}: BuildSavedPlanSelectionStateOptions): SavedPlanSelectionStateResult | null => {
  const url = buildShareUrlForState({
    selectedId: selection.selectedId,
    selectedParkingSpaceKey: selection.targetKey ?? null,
    routeProfile: selection.routeProfile ?? selectedRouteProfile,
    activeView: 'MAP',
  })
  if (!url) {
    return null
  }

  const existingPlan = savedPlans.find((plan) => plan.url === url) ?? null

  return {
    existingPlan,
    nextPlan: buildSavedPlanEntry({
      title: selection.title,
      url,
      datasetId,
      addressLabel: searchLocationLabel,
      segmentName: selection.segmentName,
      targetLabel: selection.targetLabel,
      recommendationRankMode,
      routeProfile: selection.routeProfile ?? selectedRouteProfile,
      riskMode,
      mode,
      radiusMeters,
      actionFilter,
      routeEta: {
        walkingDurationSeconds: selection.walkingDurationSeconds ?? null,
        walkingEstimated: selection.walkingEstimated,
        drivingDurationSeconds: selection.drivingDurationSeconds ?? null,
        drivingEstimated: selection.drivingEstimated,
      },
      allowedAction: selection.allowedAction,
      parkingSpaceCount: selection.parkingSpaceCount,
      tier: selection.tier,
    }),
    successMessage: existingPlan ? 'Saved plan updated.' : 'Saved to trip board.',
    url,
  }
}

export const buildListSegmentSavedPlanSelection = (
  segment: SegmentListItem,
): SavedPlanSelectionOptions => ({
  selectedId: segment.id,
  targetKey: segment.quickActionTargetKey ?? null,
  title: segment.recommendationRank
    ? `${segment.name} (${segment.recommendationRank === 1 ? 'Best exact target' : `Option ${segment.recommendationRank}`})`
    : segment.name,
  segmentName: segment.name,
  targetLabel: segment.quickActionTargetLabel ?? segment.recommendedTargetLabel ?? null,
  walkingDurationSeconds: segment.recommendedWalkingDurationSeconds ?? null,
  walkingEstimated: segment.recommendedWalkingEstimated,
  drivingDurationSeconds: segment.recommendedDrivingDurationSeconds ?? null,
  drivingEstimated: segment.recommendedDrivingEstimated,
  allowedAction: segment.allowedNow,
  parkingSpaceCount: segment.parkingSpaceCount ?? null,
  tier: segment.tier,
})

export const buildBestRecommendationSavedPlanSelection = ({
  bestAddressRecommendation,
  bestAddressRecommendationRouteEta,
  bestAddressRecommendationTarget,
}: {
  bestAddressRecommendation: SavedPlanShareSegment | null
  bestAddressRecommendationRouteEta: SavedPlanRouteEtaSummary | null
  bestAddressRecommendationTarget: SavedPlanShareTarget | null
}): SavedPlanSelectionOptions | null => {
  if (!bestAddressRecommendation || !bestAddressRecommendationTarget) {
    return null
  }

  return {
    selectedId: bestAddressRecommendation.id,
    targetKey: bestAddressRecommendationTarget.targetKey,
    title: `${bestAddressRecommendation.name} (Best exact target)`,
    segmentName: bestAddressRecommendation.name,
    targetLabel: bestAddressRecommendationTarget.targetLabel,
    walkingDurationSeconds: bestAddressRecommendationRouteEta?.walkingDurationSeconds ?? null,
    walkingEstimated: bestAddressRecommendationRouteEta?.walkingEstimated,
    drivingDurationSeconds: bestAddressRecommendationRouteEta?.drivingDurationSeconds ?? null,
    drivingEstimated: bestAddressRecommendationRouteEta?.drivingEstimated,
    allowedAction: bestAddressRecommendation.allowedNow,
    parkingSpaceCount: bestAddressRecommendation.parkingSpaceCount ?? null,
    tier: bestAddressRecommendation.tier,
  }
}
