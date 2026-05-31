import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import { addSavedPlanValue } from './savedPlanMutations'
import {
  buildSavedPlanCurrentTitle,
  buildSavedPlanEntry,
  type SavedPlanRouteEtaSummary,
} from './savedPlanShareModel'
import type { SavedPlanShareSegment } from './savedPlanSaveTypes'
import type { SavedPlan } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanCurrentViewSaveActionOptions {
  currentShareUrl: string | null
  currentSavedPlan: SavedPlan | null
  datasetId: string | null
  searchLocationLabel: string | null
  filterQuery: string
  recommendationRankMode: AddressRecommendationRankMode
  selectedRouteProfile: RouteProfile
  riskMode: RiskMode
  mode: TimeMode
  radiusMeters: number
  actionFilter: SegmentActionFilter
  selectedSegment: SavedPlanShareSegment | null
  selectedArrivalLabel: string | null
  selectedRouteEta: SavedPlanRouteEtaSummary | null
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface UseSavedPlanCurrentViewSaveActionResult {
  handleSaveCurrentPlan: () => void
}

export const useSavedPlanCurrentViewSaveAction = ({
  currentShareUrl,
  currentSavedPlan,
  datasetId,
  searchLocationLabel,
  filterQuery,
  recommendationRankMode,
  selectedRouteProfile,
  riskMode,
  mode,
  radiusMeters,
  actionFilter,
  selectedSegment,
  selectedArrivalLabel,
  selectedRouteEta,
  savedPlanLimit,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanCurrentViewSaveActionOptions): UseSavedPlanCurrentViewSaveActionResult => {
  const handleSaveCurrentPlan = useCallback(() => {
    if (!currentShareUrl) {
      setShareStatus({
        kind: 'error',
        message: 'Pick an address or parking target first.',
      })
      return
    }

    const nextTitle = buildSavedPlanCurrentTitle(
      selectedSegment?.name,
      searchLocationLabel,
      filterQuery,
    )

    setSavedPlans((current) =>
      addSavedPlanValue(
        current,
        buildSavedPlanEntry({
          title: nextTitle,
          url: currentShareUrl,
          datasetId,
          addressLabel: searchLocationLabel,
          segmentName: selectedSegment?.name ?? null,
          targetLabel: selectedArrivalLabel,
          recommendationRankMode,
          routeProfile: selectedRouteProfile,
          riskMode,
          mode,
          radiusMeters,
          actionFilter,
          routeEta: selectedRouteEta,
          allowedAction: selectedSegment?.allowedNow,
          parkingSpaceCount: selectedSegment?.parkingSpaceCount,
          tier: selectedSegment?.tier,
        }),
        savedPlanLimit,
      ),
    )
    clearSavedPlanConflictsForUrls([currentShareUrl])
    setShareStatus({
      kind: 'success',
      message: currentSavedPlan ? 'Saved plan updated.' : 'Saved to trip board.',
    })
  }, [
    actionFilter,
    clearSavedPlanConflictsForUrls,
    currentSavedPlan,
    currentShareUrl,
    datasetId,
    filterQuery,
    mode,
    radiusMeters,
    recommendationRankMode,
    riskMode,
    savedPlanLimit,
    searchLocationLabel,
    selectedArrivalLabel,
    selectedRouteEta,
    selectedRouteProfile,
    selectedSegment,
    setSavedPlans,
    setShareStatus,
  ])

  return {
    handleSaveCurrentPlan,
  }
}
