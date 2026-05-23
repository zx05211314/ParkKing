import {
  useSavedPlanCurrentShareActions,
} from './useSavedPlanCurrentShareActions'
import {
  useSavedPlanSaveActions,
} from './useSavedPlanSaveActions'
import type {
  UseSavedPlanSaveAndShareActionsOptions,
  UseSavedPlanSaveAndShareActionsResult,
} from './savedPlanSaveAndShareActionTypes'

export const useSavedPlanSaveAndShareActions = ({
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
}: UseSavedPlanSaveAndShareActionsOptions): UseSavedPlanSaveAndShareActionsResult => {
  const {
    handleSaveListSegment,
    handleSaveBestRecommendationPlan,
    handleSaveCurrentPlan,
  } = useSavedPlanSaveActions({
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
  })

  const { handleCopyShareLink, handleNativeShare } = useSavedPlanCurrentShareActions({
    currentShareUrl,
    searchLocationLabel,
    selectedSegmentName: selectedSegment?.name ?? null,
    setShareStatus,
  })

  return {
    handleSaveListSegment,
    handleSaveBestRecommendationPlan,
    handleSaveCurrentPlan,
    handleCopyShareLink,
    handleNativeShare,
  }
}
