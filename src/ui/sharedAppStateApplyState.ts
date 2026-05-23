import { getCurrentHHMM, getDemoHHMM } from '../domain/rules/time'
import { DEFAULT_SEGMENT_ACTION_FILTER } from './segmentActionFilter'
import type { ApplySharedAppStateSnapshotOptions } from './sharedAppStateApplyTypes'
import type { SharedAppState } from './shareState'

export const clampSharedRadiusMeters = (
  radiusMeters: number | null,
  defaultRadiusMeters: number,
) =>
  radiusMeters !== null
    ? Math.max(100, Math.min(3000, Math.round(radiusMeters)))
    : defaultRadiusMeters

export const resolveSharedActiveView = (nextState: SharedAppState) =>
  nextState.activeView ??
  (nextState.searchResult || nextState.selectedId ? 'MAP' : 'LIST')

export const applySharedAppStateSnapshot = ({
  nextState,
  makeCameraKey,
  defaultRecommendationRankMode,
  defaultRouteProfile,
  defaultRiskMode,
  defaultRadiusMeters,
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
}: ApplySharedAppStateSnapshotOptions) => {
  geocodeRequestIdRef.current += 1
  routeRequestIdRef.current += 1
  selectedRouteRequestIdRef.current += 1
  selectedRouteEtaRequestIdRef.current += 1

  setDatasetId(nextState.datasetId)
  setFilterQuery(nextState.filterQuery)
  setAddressQuery(nextState.searchResult?.label ?? '')
  setGeocodeResults([])
  setGeocodeStatus('idle')
  setGeocodeError(null)
  setSearchAnchor(
    nextState.searchResult
      ? {
          key: makeCameraKey(`share:${nextState.searchResult.id}`),
          result: nextState.searchResult,
        }
      : null,
  )
  setSelectedId(nextState.selectedId)
  setSelectedParkingSpaceKeyBySegment(
    nextState.selectedId && nextState.selectedParkingSpaceKey
      ? {
          [nextState.selectedId]: nextState.selectedParkingSpaceKey,
        }
      : {},
  )
  setRecommendationRankMode(
    nextState.recommendationRankMode ?? defaultRecommendationRankMode,
  )
  setSelectedRouteProfile(nextState.routeProfile ?? defaultRouteProfile)
  setSelectedRoutePath(null)
  setSelectedRouteStatus('idle')
  setSelectedRouteError(null)
  setSelectedTargetRouteEta(null)
  setRouteEtaBySegmentId({})
  setRouteEtaStatus('idle')
  setRouteEtaError(null)
  setRiskMode(nextState.riskMode ?? defaultRiskMode)
  setActionFilter(nextState.actionFilter ?? DEFAULT_SEGMENT_ACTION_FILTER)
  setIncludeInferred(nextState.includeInferred ?? false)
  setMarkedSpacesOnly(nextState.markedSpacesOnly ?? false)
  setHideReportedIllegal(nextState.hideReportedIllegal ?? false)
  setRadiusMeters(
    clampSharedRadiusMeters(nextState.radiusMeters, defaultRadiusMeters),
  )

  const nextMode = nextState.mode ?? 'NOW'
  setMode(nextMode)
  setNowHHMM(nextMode === 'NOW' ? getCurrentHHMM() : getDemoHHMM(nextMode))
  setActiveView(resolveSharedActiveView(nextState))
}
