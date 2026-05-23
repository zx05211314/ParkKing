import type { UseSharedAppStateControllerOptions } from './sharedAppStateControllerTypes'
import type { SharedAppState } from './shareState'

export type SharedAppStateApplyOptions = Pick<
  UseSharedAppStateControllerOptions,
  | 'defaultRecommendationRankMode'
  | 'defaultRouteProfile'
  | 'defaultRiskMode'
  | 'defaultRadiusMeters'
  | 'cameraRequestIdRef'
  | 'geocodeRequestIdRef'
  | 'routeRequestIdRef'
  | 'selectedRouteRequestIdRef'
  | 'selectedRouteEtaRequestIdRef'
  | 'setDatasetId'
  | 'setFilterQuery'
  | 'setAddressQuery'
  | 'setGeocodeResults'
  | 'setGeocodeStatus'
  | 'setGeocodeError'
  | 'setSearchAnchor'
  | 'setSelectedId'
  | 'setSelectedParkingSpaceKeyBySegment'
  | 'setRecommendationRankMode'
  | 'setSelectedRouteProfile'
  | 'setSelectedRoutePath'
  | 'setSelectedRouteStatus'
  | 'setSelectedRouteError'
  | 'setSelectedTargetRouteEta'
  | 'setRouteEtaBySegmentId'
  | 'setRouteEtaStatus'
  | 'setRouteEtaError'
  | 'setRiskMode'
  | 'setActionFilter'
  | 'setIncludeInferred'
  | 'setMarkedSpacesOnly'
  | 'setHideReportedIllegal'
  | 'setRadiusMeters'
  | 'setMode'
  | 'setNowHHMM'
  | 'setActiveView'
>

export interface UseSharedAppStateApplyResult {
  makeCameraKey: (prefix: string) => string
  applySharedState: (nextState: SharedAppState) => void
}

export interface ApplySharedAppStateSnapshotOptions
  extends Omit<SharedAppStateApplyOptions, 'cameraRequestIdRef'> {
  makeCameraKey: (prefix: string) => string
  nextState: SharedAppState
}
