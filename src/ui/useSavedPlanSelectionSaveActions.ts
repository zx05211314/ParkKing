import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import { addSavedPlanValue } from './savedPlanMutations'
import { type SavedPlanRouteEtaSummary } from './savedPlanShareModel'
import type {
  SavedPlanSelectionOptions,
  SavedPlanShareSegment,
  SavedPlanShareTarget,
} from './savedPlanSaveTypes'
import {
  buildBestRecommendationSavedPlanSelection,
  buildListSegmentSavedPlanSelection,
  buildSavedPlanSelectionState,
} from './savedPlanSelectionSaveState'
import type { SavedPlan } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './shareState'
import type { SegmentListItem } from './segmentListTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanSelectionSaveActionsOptions {
  buildShareUrlForState: (overrides: Partial<SharedAppState>) => string | null
  savedPlans: SavedPlan[]
  datasetId: string | null
  searchLocationLabel: string | null
  recommendationRankMode: AddressRecommendationRankMode
  selectedRouteProfile: RouteProfile
  riskMode: RiskMode
  mode: TimeMode
  radiusMeters: number
  actionFilter: SegmentActionFilter
  bestAddressRecommendation: SavedPlanShareSegment | null
  bestAddressRecommendationTarget: SavedPlanShareTarget | null
  bestAddressRecommendationRouteEta: SavedPlanRouteEtaSummary | null
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface UseSavedPlanSelectionSaveActionsResult {
  handleSaveListSegment: (segment: SegmentListItem) => void
  handleSaveBestRecommendationPlan: () => void
}

export const useSavedPlanSelectionSaveActions = ({
  buildShareUrlForState,
  savedPlans,
  datasetId,
  searchLocationLabel,
  recommendationRankMode,
  selectedRouteProfile,
  riskMode,
  mode,
  radiusMeters,
  actionFilter,
  bestAddressRecommendation,
  bestAddressRecommendationTarget,
  bestAddressRecommendationRouteEta,
  savedPlanLimit,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanSelectionSaveActionsOptions): UseSavedPlanSelectionSaveActionsResult => {
  const handleSavePlanSelection = useCallback(
    (options: SavedPlanSelectionOptions) => {
      const selectionState = buildSavedPlanSelectionState({
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
        selection: options,
      })
      if (!selectionState) {
        setShareStatus({
          kind: 'error',
          message: 'Pick an address or parking target first.',
        })
        return
      }

      setSavedPlans((current) =>
        addSavedPlanValue(
          current,
          selectionState.nextPlan,
          savedPlanLimit,
        ),
      )
      clearSavedPlanConflictsForUrls([selectionState.url])
      setShareStatus({
        kind: 'success',
        message: selectionState.successMessage,
      })
    },
    [
      actionFilter,
      buildShareUrlForState,
      clearSavedPlanConflictsForUrls,
      datasetId,
      mode,
      radiusMeters,
      recommendationRankMode,
      riskMode,
      savedPlanLimit,
      savedPlans,
      searchLocationLabel,
      selectedRouteProfile,
      setSavedPlans,
      setShareStatus,
    ],
  )

  const handleSaveListSegment = useCallback(
    (segment: SegmentListItem) => {
      handleSavePlanSelection(buildListSegmentSavedPlanSelection(segment))
    },
    [handleSavePlanSelection],
  )

  const handleSaveBestRecommendationPlan = useCallback(() => {
    const selection = buildBestRecommendationSavedPlanSelection({
      bestAddressRecommendation,
      bestAddressRecommendationRouteEta,
      bestAddressRecommendationTarget,
    })
    if (!selection) {
      return
    }
    handleSavePlanSelection(selection)
  }, [
    bestAddressRecommendation,
    bestAddressRecommendationRouteEta,
    bestAddressRecommendationTarget,
    handleSavePlanSelection,
  ])

  return {
    handleSaveListSegment,
    handleSaveBestRecommendationPlan,
  }
}
