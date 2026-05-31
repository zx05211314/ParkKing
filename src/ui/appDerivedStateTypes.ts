import type { MapBounds } from '../map/bounds'
import type { GeocodeResult } from '../map/geocoder'
import type { RouteProfile } from '../map/routing'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { DatasetMeta } from '../data/segmentBuilder'
import type { AddressRecommendationRankMode } from './addressRecommendationTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { SharedAppState } from './sharedAppStateTypes'

export interface SearchAnchorLike {
  result: GeocodeResult
}

export interface DatasetOption {
  id: string
  label: string
}

export interface AppDerivedStateOptions {
  actionFilter: SegmentActionFilter
  activeView: 'LIST' | 'MAP'
  datasetId: string | null
  datasetMeta: DatasetMeta | null
  datasetOptions: DatasetOption[]
  defaultRadiusMeters: number
  defaultRecommendationRankMode: AddressRecommendationRankMode
  defaultRiskMode: RiskMode
  defaultRouteProfile: RouteProfile
  defaultSegmentActionFilter: SegmentActionFilter
  filterQuery: string
  hideReportedIllegal: boolean
  includeInferred: boolean
  locationLabel: string
  markedSpacesOnly: boolean
  mode: TimeMode
  radiusMeters: number
  recommendationRankMode: AddressRecommendationRankMode
  riskMode: RiskMode
  searchAnchor: SearchAnchorLike | null
  selectedId: string | null
  selectedParkingSpaceKeyBySegment: Record<string, string>
  selectedRouteProfile: RouteProfile
  userLocation: [number, number] | null
}

export interface AppDerivedStateResult {
  activeDistanceLabel: string
  activeDistanceLocation: [number, number] | null
  datasetHash: string
  datasetLabelById: Map<string, string>
  districtBounds: MapBounds | null
  districtBoundsKey: string | null
  districtName: string
  hasShareableState: boolean
  mapCenter: [number, number]
  navigationOrigin: [number, number] | null
  navigationSourceLabel: string | null
  schemaVersion: number | string
  searchLocation: [number, number] | null
  searchLocationLabel: string | null
  selectedParkingShareKey: string | null
  selectedRouteProfileLabel: string
  sharedAppState: SharedAppState
}
