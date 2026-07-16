import type { UseAppLifecycleEffectsOptions } from './appLifecycleEffectTypes'
import { useComparedSavedPlanCleanupEffect } from './useComparedSavedPlanCleanupEffect'
import { useDatasetRuntimeResetEffect } from './useDatasetRuntimeResetEffect'
import { useMapPrefetchEffect } from './useMapPrefetchEffect'
import { useNowHHMMRefEffect } from './useNowHHMMRefEffect'
import { usePersistedSettingsEffect } from './usePersistedSettingsEffect'
import { useShareStatusResetEffect } from './useShareStatusResetEffect'

export const useAppLifecycleEffects = ({
  nowHHMM,
  nowHHMMRef,
  activeView,
  datasetStatus,
  mapPrefetchRef,
  preloadMapView,
  datasetId,
  radiusMeters,
  riskMode,
  actionFilter,
  includeInferred,
  showZones,
  showIntersectionZones,
  showCrosswalkZones,
  showParkingSpaces,
  markedSpacesOnly,
  hideReportedIllegal,
  showInferredCandidates,
  useMockLocation,
  favoriteAddresses,
  recentAddressSearches,
  savedPlans,
  tripBoardSortMode,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  tripBoardFilters,
  collapsedSavedPlanGroups,
  recommendationRankMode,
  selectedRouteProfile,
  shareStatus,
  setShareStatus,
  setComparedSavedPlanUrls,
  datasetHash,
  datasetHashRef,
  datasetIdRef,
  zoneParamsVersionRef,
  workerClientRef,
  setClipCacheStats,
  setEvaluatedSegments,
  setEvaluationStatus,
  setSelectedParkingSpaceKeyBySegment,
  setSelectedTargetRouteEta,
}: UseAppLifecycleEffectsOptions) => {
  useNowHHMMRefEffect(nowHHMM, nowHHMMRef)
  useMapPrefetchEffect(activeView, datasetStatus, mapPrefetchRef, preloadMapView)
  usePersistedSettingsEffect({
    datasetId,
    radiusMeters,
    riskMode,
    actionFilter,
    includeInferred,
    showZones,
    showIntersectionZones,
    showCrosswalkZones,
    showParkingSpaces,
    markedSpacesOnly,
    hideReportedIllegal,
    showInferredCandidates,
    useMockLocation,
    favoriteAddresses,
    recentAddressSearches,
    tripBoardSortMode,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    tripBoardFilters,
    collapsedSavedPlanGroups,
    recommendationRankMode,
    selectedRouteProfile,
  })
  useShareStatusResetEffect(shareStatus, setShareStatus)
  useComparedSavedPlanCleanupEffect(savedPlans, setComparedSavedPlanUrls)
  useDatasetRuntimeResetEffect({
    datasetHash,
    datasetHashRef,
    datasetId,
    datasetIdRef,
    zoneParamsVersionRef,
    workerClientRef,
    setClipCacheStats,
    setEvaluatedSegments,
    setEvaluationStatus,
    setSelectedParkingSpaceKeyBySegment,
    setSelectedTargetRouteEta,
  })
}
