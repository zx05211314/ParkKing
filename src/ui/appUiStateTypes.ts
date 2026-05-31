import type { RiskMode } from '../domain/ranking/policy'
import type { Zone } from '../domain/zones/zoneTypes'
import type { GeocodeResult } from '../map/geocoder'
import type { RouteProfile } from '../map/routing'
import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import type { DatasetMeta } from '../data/segmentBuilder'
import type { Segment } from './types'
import type {
  DatasetManifest,
  IngestReport,
  LatestPointer,
} from './datasetInfo/model'
import type { SharedAppState } from './shareState'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { AddressRecommendationRankMode } from './addressRecommendations'

export type GeocodeStatus = 'idle' | 'searching' | 'ready' | 'error'
export type SearchAnchor = { key: string; result: GeocodeResult }
export type SegmentRouteEta = {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}
export type RouteOverlayStatus = 'idle' | 'loading' | 'ready' | 'error'
export type DatasetOption = { id: string; label: string }
export type ShareStatus = {
  kind: 'success' | 'error'
  message: string
}

export interface UseAppControlUiStateOptions {
  fallbackDatasetOptions: DatasetOption[]
  initialSharedState: SharedAppState
  defaultRadiusMeters: number
  defaultRiskMode: RiskMode
  defaultSegmentActionFilter: SegmentActionFilter
}

export interface UseAppSearchUiStateOptions {
  initialSharedState: SharedAppState
}

export interface UseAppRouteUiStateOptions {
  initialSharedState: SharedAppState
  defaultRecommendationRankMode: AddressRecommendationRankMode
  defaultRouteProfile: RouteProfile
}

export interface UseAppDatasetUiStateResult {
  crosswalkCount: number
  datasetMeta: DatasetMeta | null
  datasetStatus: 'loading' | 'ready' | 'error'
  inferredCount: number
  ingestReport: IngestReport | null
  infoOpen: boolean
  intersectionCount: number
  latestInfo: LatestPointer | null
  manifestInfo: DatasetManifest | null
  metricsHistory: string | null
  overrideCount: number
  packError: string | null
  parkingSpaceCount: number
  parkingSpaces: ParkingSpaceCollection
  reportVersion: number
  segments: Segment[]
  shareStatus: ShareStatus | null
  zones: Zone[]
  setCrosswalkCount: (value: number) => void
  setDatasetMeta: (value: DatasetMeta | null) => void
  setDatasetStatus: (value: 'loading' | 'ready' | 'error') => void
  setInferredCount: (value: number) => void
  setIngestReport: (value: IngestReport | null) => void
  setInfoOpen: (value: boolean) => void
  setIntersectionCount: (value: number) => void
  setLatestInfo: (value: LatestPointer | null) => void
  setManifestInfo: (value: DatasetManifest | null) => void
  setMetricsHistory: (value: string | null) => void
  setOverrideCount: (value: number) => void
  setPackError: (value: string | null) => void
  setParkingSpaceCount: (value: number) => void
  setParkingSpaces: (value: ParkingSpaceCollection) => void
  setReportVersion: (value: number | ((prev: number) => number)) => void
  setSegments: (value: Segment[]) => void
  setShareStatus: (value: ShareStatus | null) => void
  setZones: (value: Zone[]) => void
}

export interface UseAppUiStateOptions
  extends UseAppControlUiStateOptions,
    UseAppSearchUiStateOptions,
    UseAppRouteUiStateOptions {}
