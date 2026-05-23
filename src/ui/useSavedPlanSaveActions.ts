import type { Dispatch, SetStateAction } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import { type SavedPlanRouteEtaSummary } from './savedPlanShareModel'
import type {
  SavedPlanShareSegment,
  SavedPlanShareTarget,
} from './savedPlanSaveTypes'
import type { SavedPlan } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './shareState'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import {
  useSavedPlanCurrentViewSaveAction,
  type UseSavedPlanCurrentViewSaveActionResult,
} from './useSavedPlanCurrentViewSaveAction'
import {
  useSavedPlanSelectionSaveActions,
  type UseSavedPlanSelectionSaveActionsResult,
} from './useSavedPlanSelectionSaveActions'

interface UseSavedPlanSaveActionsOptions {
  buildShareUrlForState: (overrides: Partial<SharedAppState>) => string | null
  currentShareUrl: string | null
  currentSavedPlan: SavedPlan | null
  savedPlans: SavedPlan[]
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
  bestAddressRecommendation: SavedPlanShareSegment | null
  bestAddressRecommendationTarget: SavedPlanShareTarget | null
  bestAddressRecommendationRouteEta: SavedPlanRouteEtaSummary | null
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface UseSavedPlanSaveActionsResult {
  handleSaveListSegment: UseSavedPlanSelectionSaveActionsResult['handleSaveListSegment']
  handleSaveBestRecommendationPlan:
    UseSavedPlanSelectionSaveActionsResult['handleSaveBestRecommendationPlan']
  handleSaveCurrentPlan:
    UseSavedPlanCurrentViewSaveActionResult['handleSaveCurrentPlan']
}

export const useSavedPlanSaveActions = ({
  buildShareUrlForState,
  currentShareUrl,
  currentSavedPlan,
  savedPlans,
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
  bestAddressRecommendation,
  bestAddressRecommendationTarget,
  bestAddressRecommendationRouteEta,
  savedPlanLimit,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanSaveActionsOptions): UseSavedPlanSaveActionsResult => {
  const { handleSaveListSegment, handleSaveBestRecommendationPlan } =
    useSavedPlanSelectionSaveActions({
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
    })

  const { handleSaveCurrentPlan } = useSavedPlanCurrentViewSaveAction({
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
  })

  return {
    handleSaveListSegment,
    handleSaveBestRecommendationPlan,
    handleSaveCurrentPlan,
  }
}
