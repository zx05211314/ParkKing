import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { GeocodeResult } from '../map/geocoder'
import type { RoutePathEntry, RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './shareState'

export type GeocodeStatus = 'idle' | 'searching' | 'ready' | 'error'
export type RouteOverlayStatus = 'idle' | 'loading' | 'ready' | 'error'
export type SearchAnchor = { key: string; result: GeocodeResult }
export type SegmentRouteEta = {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export interface UseSharedAppStateControllerOptions {
  sharedAppState: SharedAppState
  hasShareableState: boolean
  defaultRecommendationRankMode: AddressRecommendationRankMode
  defaultRouteProfile: RouteProfile
  defaultRiskMode: RiskMode
  defaultRadiusMeters: number
  cameraRequestIdRef: MutableRefObject<number>
  geocodeRequestIdRef: MutableRefObject<number>
  routeRequestIdRef: MutableRefObject<number>
  selectedRouteRequestIdRef: MutableRefObject<number>
  selectedRouteEtaRequestIdRef: MutableRefObject<number>
  setDatasetId: Dispatch<SetStateAction<string | null>>
  setFilterQuery: Dispatch<SetStateAction<string>>
  setAddressQuery: Dispatch<SetStateAction<string>>
  setGeocodeResults: Dispatch<SetStateAction<GeocodeResult[]>>
  setGeocodeStatus: Dispatch<SetStateAction<GeocodeStatus>>
  setGeocodeError: Dispatch<SetStateAction<string | null>>
  setSearchAnchor: Dispatch<SetStateAction<SearchAnchor | null>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setSelectedParkingSpaceKeyBySegment: Dispatch<SetStateAction<Record<string, string>>>
  setRecommendationRankMode: Dispatch<SetStateAction<AddressRecommendationRankMode>>
  setSelectedRouteProfile: Dispatch<SetStateAction<RouteProfile>>
  setSelectedRoutePath: Dispatch<SetStateAction<RoutePathEntry | null>>
  setSelectedRouteStatus: Dispatch<SetStateAction<RouteOverlayStatus>>
  setSelectedRouteError: Dispatch<SetStateAction<string | null>>
  setSelectedTargetRouteEta: Dispatch<SetStateAction<SegmentRouteEta | null>>
  setRouteEtaBySegmentId: Dispatch<SetStateAction<Record<string, SegmentRouteEta>>>
  setRouteEtaStatus: Dispatch<SetStateAction<RouteOverlayStatus>>
  setRouteEtaError: Dispatch<SetStateAction<string | null>>
  setRiskMode: Dispatch<SetStateAction<RiskMode>>
  setActionFilter: Dispatch<SetStateAction<SegmentActionFilter>>
  setIncludeInferred: Dispatch<SetStateAction<boolean>>
  setMarkedSpacesOnly: Dispatch<SetStateAction<boolean>>
  setHideReportedIllegal: Dispatch<SetStateAction<boolean>>
  setRadiusMeters: Dispatch<SetStateAction<number>>
  setMode: Dispatch<SetStateAction<TimeMode>>
  setNowHHMM: Dispatch<SetStateAction<string>>
  setActiveView: Dispatch<SetStateAction<'LIST' | 'MAP'>>
}

export interface UseSharedAppStateControllerResult {
  currentShareUrl: string | null
  buildShareUrlForState: (overrides: Partial<SharedAppState>) => string | null
  makeCameraKey: (prefix: string) => string
  applySharedState: (nextState: SharedAppState) => void
}
