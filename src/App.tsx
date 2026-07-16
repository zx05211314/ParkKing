import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDeferredValue } from 'react'
import './App.css'
import { type RouteProfile } from './map/routing'
import { ZONE_PARAMS_VERSION } from './domain/zones/constants'
import { ZoneType } from './domain/zones/zoneTypes'
import type { ZoneIndex } from './domain/zones/zoneIndex'
import { AppMainWorkspace } from './ui/AppMainWorkspace'
import { AppHeaderPanels } from './ui/AppHeaderPanels'
import { AppOverlayHost } from './ui/AppOverlayHost'
import { FALLBACK_DATASET_OPTIONS } from './ui/displayFormatting'
import {
  RISK_MODE_LABELS,
  TRIP_BOARD_INTENT_FILTER_LABELS,
  TRIP_BOARD_SUGGESTION_FILTER_LABELS,
  formatSavedPlanComparisonValue,
  formatSavedPlanIntentSummary,
  rankModeToRouteProfile,
} from './ui/appPresentationConfig'
import { buildDatasetInfoSheetProps } from './ui/buildDatasetInfoSheetProps'
import { buildHeaderPanelsProps } from './ui/buildHeaderPanelsProps'
import { buildMainWorkspaceProps } from './ui/buildMainWorkspaceProps'
import { buildOverlayHostProps } from './ui/buildOverlayHostProps'
import { useFeedbackActions } from './ui/useFeedbackActions'
import { useRecommendationDisplayState } from './ui/useRecommendationDisplayState'
import { useTripBoard } from './ui/useTripBoard'
import { useMapLocationSelectionActions } from './ui/useMapLocationSelectionActions'
import { useAddressSearchActions } from './ui/useAddressSearchActions'
import { useAddressSearchDisplayState } from './ui/useAddressSearchDisplayState'
import { useRoutePlanningState } from './ui/useRoutePlanningState'
import { useParkingAnswerServiceState } from './ui/useParkingAnswerServiceState'
import { useClientParkingAnswerState } from './ui/useClientParkingAnswerState'
import { useResolvedLocationState } from './ui/useResolvedLocationState'
import { useSavedAddressActions } from './ui/useSavedAddressActions'
import { useSearchActionKeyboard } from './ui/useSearchActionKeyboard'
import { useSharedAppStateController } from './ui/useSharedAppStateController'
import { useStartupSyncHydration } from './ui/useStartupSyncHydration'
import { useTripBoardInteractionActions } from './ui/useTripBoardInteractionActions'
import { useTripBoardManagementActions } from './ui/useTripBoardManagementActions'
import { useSyncStatus } from './ui/useSyncStatus'
import { useSyncRecoveryEffects } from './ui/useSyncRecoveryEffects'
import { useMapFocusState } from './ui/useMapFocusState'
import { buildParkingCoverageState } from './ui/parkingCoverage'
import { useRuntimeCoverageCatalog } from './ui/useRuntimeCoverageCatalog'
import { useInteractionRefs } from './ui/useInteractionRefs'
import { useAppRefs } from './ui/useAppRefs'
import { useSavedPlanShareActions } from './ui/useSavedPlanShareActions'
import { useSelectedSegmentState } from './ui/useSelectedSegmentState'
import { useSegmentSelectionActions } from './ui/useSegmentSelectionActions'
import { useAppSelectionEffects } from './ui/useAppSelectionEffects'
import { useAppLifecycleEffects } from './ui/useAppLifecycleEffects'
import { useDatasetLoadEffects } from './ui/useDatasetLoadEffects'
import { useSegmentEvaluationState } from './ui/useSegmentEvaluationState'
import { useSegmentDisplayState } from './ui/useSegmentDisplayState'
import { useAppDerivedState } from './ui/useAppDerivedState'
import { useAppUiState } from './ui/useAppUiState'
import { useTripBoardUiState } from './ui/useTripBoardUiState'
import { useViewControlActions } from './ui/useViewControlActions'
import {
  type AddressRecommendationRankMode,
} from './ui/addressRecommendations'
import {
  DEFAULT_SAVED_PLAN_LIMIT,
  SAVED_PLAN_INTENT_LABELS,
  type TripBoardSortMode,
} from './ui/savedPlans'
import {
  DEFAULT_SEGMENT_ACTION_FILTER,
  SEGMENT_ACTION_FILTER_LABELS,
} from './ui/segmentActionFilter'
import { readSharedAppState } from './ui/shareState'
import { getDataBaseUrl } from './data/datasetResolver'
import { buildPinnedCoverageBoundary } from './data/coverageDisplay'
import { findCoverageDistrictByLocation } from './data/coverageCatalog'
import { usePaidCurbReferenceState } from './ui/usePaidCurbReferenceState'
import type { RiskMode } from './domain/ranking/policy'
import {
  getLatestReportsBySegment,
  normalizeReportSegmentId,
  readReports,
  type ReportStatus,
  type SegmentReport,
} from './feedback/reports'

const DatasetInfoSheet = lazy(() =>
  import('./ui/DatasetInfoSheet').then((module) => ({
    default: module.DatasetInfoSheet,
  })),
)

const preloadMapView = () => import('./map/MapView')

const DEFAULT_RADIUS_METERS = 600
const DEFAULT_RISK_MODE: RiskMode = 'NEUTRAL'
const DEFAULT_RECOMMENDATION_RANK_MODE: AddressRecommendationRankMode = 'WALK'
const DEFAULT_ROUTE_PROFILE: RouteProfile = 'walking'
const DEFAULT_TRIP_BOARD_SORT_MODE: TripBoardSortMode = 'RECENT'
const MAX_SELECTED_PARKING_SPACE_OPTIONS = 6
const MAX_LIST_ROUTE_TARGETS = 12
const MAX_UNTAGGED_SAVED_PLAN_QUEUE = 3
const USE_WORKER = true

function App() {
  const initialSharedState = useMemo(
    () => readSharedAppState(typeof window === 'undefined' ? '' : window.location.search),
    [],
  )
  const {
    actionFilter,
    activeView,
    addressQuery,
    crosswalkCount,
    datasetId,
    datasetMeta,
    datasetOptions,
    datasetStatus,
    favoriteAddresses,
    filterQuery,
    geocodeError,
    geocodeResults,
    geocodeStatus,
    hideReportedIllegal,
    includeInferred,
    infoOpen,
    inferredCount,
    ingestReport,
    intersectionCount,
    latestInfo,
    manifestInfo,
    mapRetryKey,
    markedSpacesOnly,
    metricsHistory,
    mode,
    nowHHMM,
    overrideCount,
    packError,
    parkingSpaceCount,
    parkingSpaces,
    radiusMeters,
    recentAddressSearches,
    recommendationRankMode,
    reportVersion,
    riskMode,
    routeEtaBySegmentId,
    routeEtaError,
    routeEtaStatus,
    searchAnchor,
    segments,
    selectedId,
    selectedParkingSpaceKeyBySegment,
    selectedRouteError,
    selectedRoutePath,
    selectedRouteProfile,
    selectedRouteStatus,
    selectedTargetRouteEta,
    setActionFilter,
    setActiveView,
    setAddressQuery,
    setDatasetId,
    setDatasetMeta,
    setDatasetOptions,
    setDatasetStatus,
    setCrosswalkCount,
    setFavoriteAddresses,
    setFilterQuery,
    setGeocodeError,
    setGeocodeResults,
    setGeocodeStatus,
    setHideReportedIllegal,
    setIncludeInferred,
    setInfoOpen,
    setInferredCount,
    setIngestReport,
    setIntersectionCount,
    setLatestInfo,
    setManifestInfo,
    setMapRetryKey,
    setMarkedSpacesOnly,
    setMetricsHistory,
    setMode,
    setNowHHMM,
    setOverrideCount,
    setPackError,
    setParkingSpaceCount,
    setParkingSpaces,
    setRadiusMeters,
    setRecentAddressSearches,
    setRecommendationRankMode,
    setReportVersion,
    setRiskMode,
    setRouteEtaBySegmentId,
    setRouteEtaError,
    setRouteEtaStatus,
    setSearchAnchor,
    setSegments,
    setSelectedId,
    setSelectedParkingSpaceKeyBySegment,
    setSelectedRouteError,
    setSelectedRoutePath,
    setSelectedRouteProfile,
    setSelectedRouteStatus,
    setSelectedTargetRouteEta,
    setShareStatus,
    setShowCrosswalkZones,
    setShowInferredCandidates,
    setShowIntersectionZones,
    setShowParkingSpaces,
    setShowZones,
    setUseMockLocation,
    setZones,
    shareStatus,
    showCrosswalkZones,
    showInferredCandidates,
    showIntersectionZones,
    showParkingSpaces,
    showZones,
    useMockLocation,
    zones,
  } = useAppUiState({
    fallbackDatasetOptions: FALLBACK_DATASET_OPTIONS,
    initialSharedState,
    defaultRadiusMeters: DEFAULT_RADIUS_METERS,
    defaultRiskMode: DEFAULT_RISK_MODE,
    defaultRecommendationRankMode: DEFAULT_RECOMMENDATION_RANK_MODE,
    defaultRouteProfile: DEFAULT_ROUTE_PROFILE,
    defaultSegmentActionFilter: DEFAULT_SEGMENT_ACTION_FILTER,
  })
  const {
    collapsedSavedPlanGroups,
    comparedSavedPlanUrls,
    editingSavedPlanUrl,
    hydrateSavedPlans,
    savedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    savedPlanConflictUrls,
    savedPlanDraftTitle,
    savedPlans,
    setCollapsedSavedPlanGroups,
    setComparedSavedPlanUrls,
    setEditingSavedPlanUrl,
    setSavedPlansHydrated,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setSavedPlanDraftTitle,
    setSavedPlans,
    setTripBoardFilters,
    setTripBoardIntentFilter,
    setTripBoardQuery,
    setTripBoardSortMode,
    setTripBoardSuggestionFilter,
    tripBoardFilters,
    tripBoardIntentFilter,
    tripBoardQuery,
    tripBoardSortMode,
    tripBoardSuggestionFilter,
  } = useTripBoardUiState({
    defaultTripBoardSortMode: DEFAULT_TRIP_BOARD_SORT_MODE,
  })
  const {
    startupSyncHydrationCompletedAt,
    startupSyncHydrationPhase,
    startupSyncHydrationSource,
  } = useStartupSyncHydration({
    hydrateSavedPlans,
    setSavedPlansHydrated,
    setReportVersion,
  })
  const syncStatus = useSyncStatus({
    startupSyncHydrationCompletedAt,
    startupSyncHydrationPhase,
    startupSyncHydrationSource,
  })
  const hasStoredDatasetIdRef = useRef(datasetId !== null)
  useEffect(() => {
    if (datasetId) {
      hasStoredDatasetIdRef.current = true
    }
  }, [datasetId])
  const deferredFilterQuery = useDeferredValue(filterQuery)

  const dataBaseUrl = getDataBaseUrl()
  const dataSourceLabel = dataBaseUrl ? `Remote (${dataBaseUrl})` : 'Local'
  const {
    catalog: runtimeCoverageCatalog,
    status: runtimeCoverageCatalogStatus,
  } = useRuntimeCoverageCatalog()
  const {
    mapPrefetchRef,
    geocodeRequestIdRef,
    routeRequestIdRef,
    selectedRouteRequestIdRef,
    selectedRouteEtaRequestIdRef,
    cameraRequestIdRef,
    filterInputRef,
    addressInputRef,
    savedPlanImportRef,
    nowHHMMRef,
    datasetHashRef,
    datasetIdRef,
    zoneParamsVersionRef,
  } = useAppRefs({
    nowHHMM,
    datasetId,
    zoneParamsVersion: ZONE_PARAMS_VERSION,
  })
  const { userLocation, locationLabel, locationStatus } = useResolvedLocationState({
    useMockLocation,
  })
  const {
    activeDistanceLabel,
    activeDistanceLocation,
    datasetHash,
    datasetLabelById,
    districtBounds,
    districtBoundsKey,
    districtName,
    hasShareableState,
    mapCenter,
    navigationOrigin,
    navigationSourceLabel,
    schemaVersion,
    searchLocation,
    searchLocationLabel,
    selectedRouteProfileLabel,
    sharedAppState,
  } = useAppDerivedState({
    actionFilter,
    activeView,
    datasetId,
    datasetMeta,
    datasetOptions,
    defaultRadiusMeters: DEFAULT_RADIUS_METERS,
    defaultRecommendationRankMode: DEFAULT_RECOMMENDATION_RANK_MODE,
    defaultRiskMode: DEFAULT_RISK_MODE,
    defaultRouteProfile: DEFAULT_ROUTE_PROFILE,
    defaultSegmentActionFilter: DEFAULT_SEGMENT_ACTION_FILTER,
    filterQuery,
    hideReportedIllegal,
    includeInferred,
    locationLabel,
    markedSpacesOnly,
    mode,
    radiusMeters,
    recommendationRankMode,
    riskMode,
    searchAnchor,
    selectedId,
    selectedParkingSpaceKeyBySegment,
    selectedRouteProfile,
    userLocation,
  })
  const parkingCoverageState = buildParkingCoverageState({
    location: searchLocation,
    districtBounds,
    districtName,
    activeDistrictId: datasetId,
    coverageCatalog: runtimeCoverageCatalog,
  })
  const parkingSearchLocation = parkingCoverageState.eligibleLocation
  const paidCurbCoverageDistrict = useMemo(() => {
    if (!runtimeCoverageCatalog || !searchLocation) {
      return null
    }
    const district = findCoverageDistrictByLocation(
      runtimeCoverageCatalog,
      searchLocation,
    )
    return district?.publishStage === 'source-only' && district.referenceData
      ? district
      : null
  }, [runtimeCoverageCatalog, searchLocation])
  const paidCurbReferenceState = usePaidCurbReferenceState({
    districtId: paidCurbCoverageDistrict?.districtId ?? null,
    referenceData: paidCurbCoverageDistrict?.referenceData ?? null,
  })
  const pinnedCoverageBoundary = useMemo(
    () => buildPinnedCoverageBoundary(runtimeCoverageCatalog, searchLocation),
    [runtimeCoverageCatalog, searchLocation],
  )
  const {
    currentShareUrl,
    buildShareUrlForState,
    makeCameraKey,
    applySharedState,
  } = useSharedAppStateController({
    sharedAppState,
    hasShareableState,
    defaultRecommendationRankMode: DEFAULT_RECOMMENDATION_RANK_MODE,
    defaultRouteProfile: DEFAULT_ROUTE_PROFILE,
    defaultRiskMode: DEFAULT_RISK_MODE,
    defaultRadiusMeters: DEFAULT_RADIUS_METERS,
    cameraRequestIdRef,
    geocodeRequestIdRef,
    routeRequestIdRef,
    selectedRouteRequestIdRef,
    selectedRouteEtaRequestIdRef,
    setDatasetId,
    setFilterQuery,
    setAddressQuery,
    setGeocodeResults,
    setGeocodeStatus,
    setGeocodeError,
    setSearchAnchor,
    setSelectedId,
    setSelectedParkingSpaceKeyBySegment,
    setRecommendationRankMode,
    setSelectedRouteProfile,
    setSelectedRoutePath,
    setSelectedRouteStatus,
    setSelectedRouteError,
    setSelectedTargetRouteEta,
    setRouteEtaBySegmentId,
    setRouteEtaStatus,
    setRouteEtaError,
    setRiskMode,
    setActionFilter,
    setIncludeInferred,
    setMarkedSpacesOnly,
    setHideReportedIllegal,
    setRadiusMeters,
    setMode,
    setNowHHMM,
    setActiveView,
  })
  const nativeShareSupported =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const canRefreshSync = syncStatus.kind !== 'local'
  const reportsBySegment = useMemo<Record<string, SegmentReport>>(() => {
    void reportVersion
    if (!datasetId) {
      return {}
    }
    return getLatestReportsBySegment(readReports(), datasetId)
  }, [datasetId, reportVersion])
  const MapViewLazy = useMemo(
    () => {
      void mapRetryKey
      return lazy(() =>
        preloadMapView().then((module) => ({
          default: module.MapView,
        })),
      )
    },
    [mapRetryKey],
  )
  const [zoneIndex, setZoneIndex] = useState<ZoneIndex | null>(null)
  useEffect(() => {
    if (zones.length === 0) {
      setZoneIndex(null)
      return
    }

    let cancelled = false
    setZoneIndex(null)
    void import('./domain/zones/zoneIndex')
      .then(({ getZoneIndex }) => {
        if (!cancelled) {
          setZoneIndex(getZoneIndex(zones, datasetHash, ZONE_PARAMS_VERSION))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setZoneIndex(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [zones, datasetHash])
  const {
    workerClientRef,
    evaluationStatus,
    setEvaluationStatus,
    clipCacheStats,
    setClipCacheStats,
    evaluatedSegments,
    setEvaluatedSegments,
  } = useSegmentEvaluationState({
    segments,
    zones,
    datasetHash,
    nowHHMM,
    nowHHMMRef,
    zoneIndex,
    useWorker: USE_WORKER,
  })

  const intersectionZones = useMemo(
    () => zones.filter((zone) => zone.type === ZoneType.INTERSECTION_BUFFER),
    [zones],
  )
  const crosswalkZones = useMemo(
    () => zones.filter((zone) => zone.type === ZoneType.CROSSWALK_BUFFER),
    [zones],
  )
  const regularZones = useMemo(
    () =>
      zones.filter(
        (zone) =>
          zone.type !== ZoneType.INTERSECTION_BUFFER &&
          zone.type !== ZoneType.CROSSWALK_BUFFER,
      ),
    [zones],
  )
  useAppLifecycleEffects({
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
  })
  useDatasetLoadEffects({
    datasetId,
    setDatasetOptions,
    setDatasetId,
    setDatasetStatus,
    setSelectedId,
    setSegments,
    setParkingSpaces,
    setZones,
    setParkingSpaceCount,
    setIntersectionCount,
    setCrosswalkCount,
    setOverrideCount,
    setInferredCount,
    setDatasetMeta,
    setLatestInfo,
    setManifestInfo,
    setIngestReport,
    setMetricsHistory,
    setPackError,
  })

  const {
    segmentsWithDistance,
    illegalFeedbackHiddenCount,
    actionFilterHiddenCount,
    actionFilteredMarkedSpaceSegmentCount,
    filteredSegments,
    segmentFilterSuggestions,
    recommendationSortableSegments,
    addressRecommendationCandidates,
    addressRecommendationTargets,
    displaySegments,
    displaySegmentTotalCount,
    displaySegmentLimit,
  } = useSegmentDisplayState({
    evaluatedSegments,
    activeDistanceLocation,
    includeInferred,
    radiusMeters,
    riskMode,
    hideReportedIllegal,
    reportsBySegment,
    actionFilter,
    markedSpacesOnly,
    deferredFilterQuery,
    filterQuery,
    searchLocation: parkingSearchLocation,
    recommendationRankMode,
    routeEtaBySegmentId,
    parkingSpaces,
    navigationOrigin,
    selectedParkingSpaceKeyBySegment,
  })
  const clientParkingAnswer = useClientParkingAnswerState({
    segments,
    searchLocation: parkingSearchLocation,
    nowHHMM,
    zoneIndex,
    includeInferred,
    riskMode,
    reviewedSignOverridesCount: datasetMeta?.signOverridesCount ?? null,
    appliedSignOverridesCount: datasetMeta?.overridesAppliedCount ?? null,
  })
  const parkingAnswerServiceState = useParkingAnswerServiceState({
    districtId: datasetId,
    searchLocation: parkingSearchLocation,
    nowHHMM,
    includeInferred,
    riskMode,
  })
  const { answer: serviceParkingAnswer } = parkingAnswerServiceState
  const parkingAnswer = serviceParkingAnswer ?? clientParkingAnswer
  const parkingAnswerPrimary = parkingAnswer?.primary ?? null
  const parkingAnswerPrimaryId = parkingAnswerPrimary?.id ?? null
  const parkingAnswerReport = useMemo(
    () =>
      parkingAnswerPrimaryId
        ? reportsBySegment[normalizeReportSegmentId(parkingAnswerPrimaryId)] ?? null
        : null,
    [parkingAnswerPrimaryId, reportsBySegment],
  )
  const {
    activeSearchQuery,
    activeFilterChips,
    hasActiveFilters,
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
  } = useRecommendationDisplayState({
    filterQuery,
    markedSpacesOnly,
    hideReportedIllegal,
    illegalFeedbackHiddenCount,
    actionFilter,
    actionFilterHiddenCount,
    includeInferred,
    radiusMeters,
    riskMode,
    defaultSegmentActionFilter: DEFAULT_SEGMENT_ACTION_FILTER,
    defaultRadiusMeters: DEFAULT_RADIUS_METERS,
    defaultRiskMode: DEFAULT_RISK_MODE,
    actionFilterLabels: SEGMENT_ACTION_FILTER_LABELS,
    riskModeLabels: RISK_MODE_LABELS,
    favoriteAddresses,
    searchAnchor,
    addressRecommendationTargets,
    reportsBySegment,
      routeEtaBySegmentId,
      recommendationRankMode,
      routeEtaStatus,
      routeEtaError,
      searchLocation: parkingSearchLocation,
      searchLocationLabel,
      displaySegments,
  })
  const {
    visibleGeocodeResults,
    visibleFavoriteAddresses,
    quickFavoriteAddresses,
    visibleRecentAddresses,
    favoriteAddressOffset,
    recentAddressOffset,
    bestRecommendationIndex,
    alternativeRecommendationOffset,
    searchActionCount,
  } = useAddressSearchDisplayState({
    geocodeResults,
    favoriteAddresses,
    recentAddressSearches,
    hasBestAddressRecommendation: bestAddressRecommendation !== null,
    alternativeRecommendationCount: alternativeAddressRecommendations.length,
  })
  const {
    segmentSuggestionRefs,
    searchActionRefs,
    registerSearchActionRef,
    registerSegmentSuggestionRef,
  } = useInteractionRefs({
    searchActionCount,
    segmentSuggestionCount: segmentFilterSuggestions.length,
  })

  const {
    selectedSegment,
    latestReport,
    selectedDistance,
    selectedRankBreakdown,
    selectedParkingSpaceMatches,
    selectedParkingSpaceMatch,
    selectedParkingSpaceOptions,
    selectedParkingSpaceMapMarkers,
    recommendedParkingTargetMarkers,
    selectedParkingSpaceTargetMode,
  } = useSelectedSegmentState({
    selectedId,
    segmentsWithDistance,
    evaluatedSegments,
    reportsBySegment,
    activeDistanceLocation,
    riskMode,
    selectedParkingSpaceKeyBySegment,
    parkingSpaces,
    navigationOrigin,
    addressRecommendationTargets,
    maxSelectedParkingSpaceOptions: MAX_SELECTED_PARKING_SPACE_OPTIONS,
  })
  const {
    selectedRouteEta,
    selectedCenter,
    selectedArrivalHint,
    selectedArrivalLabel,
    selectedArrivalKind,
    selectedNavigationLinks,
    selectedWalkDistance,
    bestAddressRecommendationArrivalHint,
    bestAddressRecommendationArrivalKind,
    bestAddressRecommendationWalkDistance,
    bestAddressRecommendationNavigationLinks,
    bestAddressRecommendationRouteEta,
  } = useRoutePlanningState({
    parkingSpaces,
    navigationOrigin,
    selectedSegment,
    selectedParkingSpaceMatch,
    selectedParkingSpaceOptions,
    recommendationSortableSegments,
    addressRecommendationCandidates,
    maxListRouteTargets: MAX_LIST_ROUTE_TARGETS,
    bestAddressRecommendation,
    bestAddressRecommendationTarget,
    routeEtaBySegmentId,
    selectedTargetRouteEta,
    selectedRouteProfile,
    routeRequestIdRef,
    selectedRouteRequestIdRef,
    selectedRouteEtaRequestIdRef,
    setRouteEtaBySegmentId,
    setRouteEtaStatus,
    setRouteEtaError,
    setSelectedTargetRouteEta,
    setSelectedRoutePath,
    setSelectedRouteStatus,
    setSelectedRouteError,
  })
  const tripBoardState = useTripBoard({
    currentShareUrl,
    savedPlans,
    savedPlanConflictUrls,
    tripBoardSortMode,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    tripBoardFilters,
    tripBoardQuery,
    comparedSavedPlanUrls,
    collapsedSavedPlanGroups,
    tripBoardIntentFilterLabels: TRIP_BOARD_INTENT_FILTER_LABELS,
    tripBoardSuggestionFilterLabels: TRIP_BOARD_SUGGESTION_FILTER_LABELS,
    formatSavedPlanIntentSummary,
    formatSavedPlanComparisonValue,
    maxUntaggedSavedPlanQueue: MAX_UNTAGGED_SAVED_PLAN_QUEUE,
  })
  const {
    currentSavedPlan,
    visibleConflictedSavedPlans,
    visibleSavedPlans,
    visibleSavedPlanUrls,
    visibleUntaggedSavedPlans,
    visibleUntaggedSavedPlanSuggestions,
    visibleUntaggedSavedPlanSuggestionSummary,
    visibleSuggestedUntaggedSavedPlans,
    visibleManualUntaggedSavedPlans,
    topSuggestedUntaggedSavedPlan,
    topManualUntaggedSavedPlan,
    visibleSavedPlanIntentLeaders,
    topVisibleSavedPlan,
    compareBoardSelection,
    topPinCandidate,
    visibleSavedPlanGroupKeys,
    comparedSavedPlans,
    comparedSavedPlanLeader,
  } = tripBoardState
  const tripBoardActions = useTripBoardInteractionActions({
    applySharedState,
    savedPlanLimit: DEFAULT_SAVED_PLAN_LIMIT,
    tripBoardSortMode,
    topVisibleSavedPlan,
    topSuggestedUntaggedSavedPlan,
    topManualUntaggedSavedPlan,
    visibleSavedPlanIntentLeaders,
    visibleConflictedSavedPlans,
    visibleSuggestedUntaggedSavedPlans,
    visibleManualUntaggedSavedPlans,
    compareBoardSelection,
    comparedSavedPlanUrls,
    topPinCandidate,
    comparedSavedPlans,
    comparedSavedPlanLeader,
    setShareStatus,
    setSavedPlans,
    setComparedSavedPlanUrls,
    savedPlanIntentLabels: SAVED_PLAN_INTENT_LABELS,
  })
  const tripBoardManagementActions = useTripBoardManagementActions({
    savedPlans,
    visibleSavedPlans,
    visibleSavedPlanUrls,
    visibleUntaggedSavedPlans,
    visibleUntaggedSavedPlanSuggestions,
    visibleUntaggedSavedPlanSuggestionSummary,
    visibleSavedPlanGroupKeys,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    editingSavedPlanUrl,
    savedPlanDraftTitle,
    savedPlanLimit: DEFAULT_SAVED_PLAN_LIMIT,
    savedPlanIntentLabels: SAVED_PLAN_INTENT_LABELS,
    savedPlanImportRef,
    savedPlanConflictDetailsByUrl,
    setSavedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlans,
    savedPlanConflictUrls,
    setSavedPlanConflictUrls,
    setTripBoardFilters,
    setTripBoardIntentFilter,
    setTripBoardSuggestionFilter,
    setTripBoardQuery,
    setCollapsedSavedPlanGroups,
    setEditingSavedPlanUrl,
    setSavedPlanDraftTitle,
    setComparedSavedPlanUrls,
    setShareStatus,
    formatSavedPlanIntentSummary,
  })
  const { activeFocusBounds, activeFocusCenter } = useMapFocusState({
    selectedSegment,
    selectedRoutePath,
    selectedRouteProfile,
    selectedCenter,
    searchAnchor,
    searchLocation,
    addressRecommendationTargets,
    recommendedSegmentIds,
  })
  const {
    handleSaveListSegment,
    handleSaveBestRecommendationPlan,
    handleSaveCurrentPlan,
    handleCopyShareLink,
    handleAutoRefreshSync,
    handleAutoRefreshSyncResources,
    handleAutoRetrySyncWrites,
    handleAutoRetrySyncWritesNow,
    handleRefreshSync,
    handleRefreshResourceSync,
    handleRetryResourceSync,
    handleNativeShare,
    isRefreshingSync,
    refreshingResources,
    retryingResources,
  } = useSavedPlanShareActions({
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
    savedPlanLimit: DEFAULT_SAVED_PLAN_LIMIT,
    setReportVersion,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setSavedPlans,
    setShareStatus,
  })
  useSyncRecoveryEffects({
    syncStatus,
    handleAutoRefreshSync,
    handleAutoRefreshSyncResources,
    handleAutoRetrySyncWrites,
    handleAutoRetrySyncWritesNow,
  })
  const {
    resolveDistrictForLocation,
    handleClearAddressSearch,
    handleAddressQueryChange,
    handleChooseGeocodeResult,
    handleChooseRecentAddress,
    handleChooseFavoriteAddress,
    handleAddressSearch,
  } = useAddressSearchActions({
    addressQuery,
    datasetId,
    datasetOptions,
    coverageCatalog: runtimeCoverageCatalog,
    coverageCatalogStatus: runtimeCoverageCatalogStatus,
    districtBounds,
    datasetMetaFile: 'dataset_meta.json',
    geocodeRequestIdRef,
    makeCameraKey,
    setAddressQuery,
    setGeocodeResults,
    setGeocodeStatus,
    setGeocodeError,
    setSearchAnchor,
    setRecentAddressSearches,
    setSelectedId,
    setActiveView,
    setDatasetId,
  })
  const handlePickMapLocation = useMapLocationSelectionActions({
    datasetId,
    geocodeRequestIdRef,
    makeCameraKey,
    resolveDistrictForLocation,
    setAddressQuery,
    setGeocodeResults,
    setGeocodeStatus,
    setGeocodeError,
    setSearchAnchor,
    setSelectedId,
    setActiveView,
    setDatasetId,
  })
  const {
    handleReportForSegment,
    handleSegmentReport,
    handleExportReports,
    handleReportIssue,
    issueReportStatus,
    reportingIssue,
  } = useFeedbackActions({
    datasetId,
    selectedSegment,
    setReportVersion,
    datasetMeta,
    nowHHMM,
    includeInferred,
    userLocation,
    zoneIndex,
  })
  const handleParkingAnswerReport = useCallback(
    (status: ReportStatus, note: string) => {
      handleReportForSegment(parkingAnswerPrimary, status, note)
    },
    [handleReportForSegment, parkingAnswerPrimary],
  )
  useAppSelectionEffects({
    hasStoredDatasetIdRef,
    datasetId,
    userLocation,
    locationStatus,
    datasetOptionsCount: datasetOptions.length,
    fallbackDatasetId: datasetOptions[0]?.id ?? null,
    resolveDistrictForLocation,
    setDatasetId,
    activeSearchQuery,
    filteredSegments,
    selectedId,
    setSelectedId,
  })
  const handleCloseSelectedSegment = useCallback(() => {
    setSelectedId(null)
  }, [setSelectedId])
  const handleOpenInfo = useCallback(() => {
    setInfoOpen(true)
  }, [setInfoOpen])
  const handleCloseInfo = useCallback(() => {
    setInfoOpen(false)
  }, [setInfoOpen])
  const {
    handleSelect,
    handleSelectSegmentSuggestion,
    handleFilterInputKeyDown,
    handleSegmentSuggestionKeyDown,
    handleRecommendationRankModeChange,
    handleSelectedRouteProfileChange,
    handleSelectSelectedParkingSpace,
    handleSelectRecommendedTarget,
    handleSelectAddressRecommendation,
    handleNavigateToRecommendation,
    handleSelectListSegment,
    handleNavigateFromListSegment,
  } = useSegmentSelectionActions({
    selectedSegment,
    segmentFilterSuggestions,
    segmentSuggestionRefs,
    filterInputRef,
    setSelectedParkingSpaceKeyBySegment,
    setSelectedId,
    setFilterQuery,
    setActiveView,
    setRecommendationRankMode,
    setSelectedRouteProfile,
    rankModeToRouteProfile,
  })
  const {
    handleToggleFavoriteAddress,
    handleSetFavoriteAddressRole,
    handleClearFavoriteAddressRole,
    handleClearFavoriteAddresses,
    handleClearRecentAddresses,
  } = useSavedAddressActions({
    setFavoriteAddresses,
    setRecentAddressSearches,
  })
  const {
    handleAddressInputKeyDown,
    handleSearchActionKeyDown,
  } = useSearchActionKeyboard({
    searchActionCount,
    searchActionRefs,
    addressInputRef,
  })
  const {
    handleModeChange,
    handleRadiusChange,
    handleClearActiveFilter,
    handleResetViewFilters,
    handleMapRetry,
    handleMapPrefetch,
  } = useViewControlActions({
    defaultRadiusMeters: DEFAULT_RADIUS_METERS,
    defaultRiskMode: DEFAULT_RISK_MODE,
    mapPrefetchRef,
    preloadMapView,
    setFilterQuery,
    setMode,
    setNowHHMM,
    setRadiusMeters,
    setActionFilter,
    setMarkedSpacesOnly,
    setHideReportedIllegal,
    setIncludeInferred,
    setRiskMode,
    setMapRetryKey,
  })
  const headerPanelsProps = buildHeaderPanelsProps({
    packError,
    datasetId,
    activeView,
    onActiveViewChange: setActiveView,
    onMapPrefetch: handleMapPrefetch,
    datasetOptions,
    onDatasetIdChange: setDatasetId,
    filterInputRef,
    filterQuery,
    onFilterQueryChange: setFilterQuery,
    onFilterInputKeyDown: handleFilterInputKeyDown,
    segmentFilterSuggestions,
    selectedId,
    onSegmentSuggestionKeyDown: handleSegmentSuggestionKeyDown,
    onSelectSegmentSuggestion: handleSelectSegmentSuggestion,
    registerSegmentSuggestionRef,
    filteredSegmentCount: filteredSegments.length,
    totalSegmentCount: segmentsWithDistance.length,
    hasActiveFilters,
    activeFilterChips,
    onResetViewFilters: handleResetViewFilters,
    onClearActiveFilter: handleClearActiveFilter,
    addressInputRef,
    addressQuery,
    geocodeStatus,
    geocodeError,
    geocodeResultsCount: geocodeResults.length,
    activeDistanceLabel,
    locationStatus,
    searchLocationLabel,
    searchAnchor,
    searchActionCount,
    isPinnedFavorite,
    pinnedFavoriteRole,
    favoriteAddresses,
    quickFavoriteAddresses,
    visibleGeocodeResults,
    visibleFavoriteAddresses,
    visibleRecentAddresses,
    favoriteAddressOffset,
    recentAddressOffset,
    registerSearchActionRef,
    onAddressQueryChange: handleAddressQueryChange,
    onAddressInputKeyDown: handleAddressInputKeyDown,
    onAddressSearch: handleAddressSearch,
    onClearAddressSearch: handleClearAddressSearch,
    onToggleFavoriteAddress: handleToggleFavoriteAddress,
    onSetFavoriteAddressRole: handleSetFavoriteAddressRole,
    onClearFavoriteAddressRole: handleClearFavoriteAddressRole,
    onChooseGeocodeResult: handleChooseGeocodeResult,
    onChooseFavoriteAddress: handleChooseFavoriteAddress,
    onClearFavoriteAddresses: handleClearFavoriteAddresses,
    onChooseRecentAddress: handleChooseRecentAddress,
    onClearRecentAddresses: handleClearRecentAddresses,
    onSearchActionKeyDown: handleSearchActionKeyDown,
    recommendationRankMode,
    addressRecommendationRankingLabel,
    addressRecommendationFeedbackLabel,
    parkingAnswer,
    parkingAnswerServiceStatus: parkingAnswerServiceState.status,
    parkingAnswerServiceError: parkingAnswerServiceState.error,
    parkingCoverageNotice: parkingCoverageState.notice,
    parkingCoverageReferenceState: paidCurbCoverageDistrict
      ? paidCurbReferenceState
      : null,
    parkingCoverageReferenceAddressLabel: paidCurbCoverageDistrict
      ? searchLocationLabel
      : null,
    parkingAnswerReport,
    nearbySnapshot,
    bestAddressRecommendation,
    bestAddressRecommendationTarget,
    bestAddressRecommendationReason,
    bestAddressRecommendationFeedback,
    bestAddressRecommendationReport,
    bestAddressRecommendationArrivalHint,
    bestAddressRecommendationArrivalKind,
    bestAddressRecommendationWalkDistance,
    bestAddressRecommendationNavigationLinks,
    bestAddressRecommendationRouteEta,
    alternativeAddressRecommendations,
    addressRecommendationEmptyMessage,
    routeEtaStatus,
    routeEtaError,
    routeEtaBySegmentId,
    reportsBySegment,
    navigationOrigin,
    searchLocation: parkingSearchLocation,
    bestRecommendationIndex,
    alternativeRecommendationOffset,
    onRecommendationRankModeChange: handleRecommendationRankModeChange,
    onParkingAnswerReport: handleParkingAnswerReport,
    onSelectAddressRecommendation: handleSelectAddressRecommendation,
    onSaveBestRecommendationPlan: handleSaveBestRecommendationPlan,
    onNavigateToRecommendation: handleNavigateToRecommendation,
    hasShareableState,
    currentShareUrl,
    currentSavedPlan: Boolean(currentSavedPlan),
    nativeShareSupported,
    syncStatus,
    canRefreshSync,
    isRefreshingSync,
    retryingResources,
    shareStatus,
    onCopyShareLink: handleCopyShareLink,
    onRefreshSync: handleRefreshSync,
    onRefreshResourceSync: handleRefreshResourceSync,
    onRetryResourceSync: handleRetryResourceSync,
    onSaveCurrentPlan: handleSaveCurrentPlan,
    onNativeShare: handleNativeShare,
    refreshingResources,
    savedPlans,
    savedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    savedPlanConflictUrls,
    tripBoardState,
    tripBoardActions,
    tripBoardManagementActions,
    tripBoardSortMode,
    onTripBoardSortModeChange: setTripBoardSortMode,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    tripBoardQuery,
    onTripBoardQueryChange: setTripBoardQuery,
    tripBoardFilters,
    datasetLabelById,
    collapsedSavedPlanGroups,
    comparedSavedPlanUrls,
    editingSavedPlanUrl,
    savedPlanDraftTitle,
    onSavedPlanDraftTitleChange: setSavedPlanDraftTitle,
    savedPlanImportRef,
    mode,
    nowHHMM,
    onModeChange: handleModeChange,
    useMockLocation,
    onUseMockLocationChange: setUseMockLocation,
    locationLabel,
    radiusMeters,
    onRadiusChange: handleRadiusChange,
    riskMode,
    onRiskModeChange: setRiskMode,
    showZones,
    onShowZonesChange: setShowZones,
    showIntersectionZones,
    onShowIntersectionZonesChange: setShowIntersectionZones,
    showCrosswalkZones,
    onShowCrosswalkZonesChange: setShowCrosswalkZones,
    showParkingSpaces,
    onShowParkingSpacesChange: setShowParkingSpaces,
    parkingSpaceCount,
    actionFilteredMarkedSpaceSegmentCount,
    markedSpacesOnly,
    onMarkedSpacesOnlyChange: setMarkedSpacesOnly,
    actionFilter,
    actionFilterHiddenCount,
    onActionFilterChange: setActionFilter,
    hideReportedIllegal,
    illegalFeedbackHiddenCount,
    onHideReportedIllegalChange: setHideReportedIllegal,
    showInferredCandidates,
    onShowInferredCandidatesChange: setShowInferredCandidates,
    includeInferred,
    onIncludeInferredChange: setIncludeInferred,
    districtName,
    schemaVersion,
    segmentsCount: datasetMeta?.segmentsCount ?? segments.length,
    inferredCount,
    overrideCount,
    signOverrideMatchedSegmentCount:
      datasetMeta?.signOverrideMatchedSegmentCount ?? null,
    signOverrideSpatialMatchCount:
      datasetMeta?.signOverrideSpatialMatchCount ?? null,
    signOverrideUnmatchedNamedCount:
      datasetMeta?.signOverrideUnmatchedNamedCount ?? null,
    zonesCount: zones.length,
    intersectionCount,
    crosswalkCount,
    builtAtValue: datasetMeta?.generatedAt,
      evaluationStatus,
      datasetStatus,
      issueReportStatus,
      reportingIssue,
      clipCacheStats,
      onReportIssue: handleReportIssue,
    onExportReports: handleExportReports,
    onOpenInfo: handleOpenInfo,
  })
  const mainWorkspaceProps = buildMainWorkspaceProps({
    activeView,
    datasetStatus,
    mapViewComponent: MapViewLazy,
    mapRetryKey,
    onMapRetry: handleMapRetry,
    center: mapCenter,
    segments: filteredSegments,
    zones: regularZones,
    intersectionZones,
    showZones,
    showIntersectionZones,
    crosswalkZones,
    showCrosswalkZones,
    parkingSpaces,
    showParkingSpaces,
    showInferredCandidates,
    selectedId,
    districtBounds,
    districtBoundsKey,
    activeFocusBounds,
    activeFocusCenter,
    recommendedSegmentIds,
    searchLocation,
    searchLocationLabel,
    coverageBoundary: pinnedCoverageBoundary,
    selectedCenter,
    selectedArrivalKind,
    selectedArrivalLabel,
    recommendedParkingTargetMarkers,
    selectedParkingSpaceMarkers: selectedParkingSpaceMapMarkers,
    selectedRouteProfile,
    selectedRoutePath,
    selectedRouteProfileLabel,
    userLocation,
    onSelectMapSegment: handleSelect,
    onSelectRecommendedTarget: handleSelectRecommendedTarget,
    onSelectParkingSpace: handleSelectSelectedParkingSpace,
    onPickMapLocation: handlePickMapLocation,
    searchAnchor,
    parkingSpaceCount,
    displaySegments,
    displaySegmentTotalCount,
    displaySegmentLimit,
    onSelectListSegment: handleSelectListSegment,
    onNavigateFromListSegment: handleNavigateFromListSegment,
    onSaveListSegment: handleSaveListSegment,
    reportsBySegment,
    emptySegmentsMessage,
    listSortSummary,
    hasActiveFilters,
    onResetViewFilters: handleResetViewFilters,
  })
  const overlayHostProps = buildOverlayHostProps({
    selectedSegment,
    nowHHMM,
    onCloseSelectedSegment: handleCloseSelectedSegment,
    selectedDistance,
    selectedWalkDistance,
    selectedRouteEta,
    selectedRankBreakdown,
    riskMode,
    latestReport,
    onSegmentReport: handleSegmentReport,
    selectedNavigationLinks,
    navigationSourceLabel,
    selectedArrivalHint,
    selectedArrivalKind,
    selectedRouteProfile,
    selectedRouteStatus,
    selectedRouteError,
    onSelectedRouteProfileChange: handleSelectedRouteProfileChange,
    selectedParkingSpaceOptions,
    selectedParkingSpaceOptionCount: selectedParkingSpaceMatches.length,
    selectedParkingSpaceTargetMode,
    onSelectSelectedParkingSpace: handleSelectSelectedParkingSpace,
  })
  const datasetInfoSheetProps = buildDatasetInfoSheetProps({
    infoOpen,
    latestInfo,
    datasetMeta,
    manifestInfo,
    ingestReport,
    metricsHistory,
    dataSourceLabel,
    onCloseInfo: handleCloseInfo,
  })

  return (
    <div className="app-shell">
      <AppHeaderPanels {...headerPanelsProps} />
      <AppMainWorkspace {...mainWorkspaceProps} />
      <AppOverlayHost {...overlayHostProps} />
      <Suspense fallback={null}>
        <DatasetInfoSheet {...datasetInfoSheetProps} />
      </Suspense>
    </div>
  )
}

export default App
