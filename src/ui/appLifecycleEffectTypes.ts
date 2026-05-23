import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { ClipCacheStats } from '../domain/geometry/clipCache'
import type { GeocodeResult } from '../map/geocoder'
import type { RouteProfile } from '../map/routing'
import type { EvaluationWorkerClient } from '../workers/evaluationClient'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { FavoriteAddress } from './recentAddresses'
import type {
  SavedPlan,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
  TripBoardFilters,
  TripBoardSortMode,
} from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { EvaluatedSegment } from './types'
import type { SegmentEvaluationStatus } from './useSegmentEvaluationState'

export interface ShareStatus {
  kind: 'success' | 'error'
  message: string
}

export interface SegmentRouteEta {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export interface UseAppLifecycleEffectsOptions {
  nowHHMM: string
  nowHHMMRef: MutableRefObject<string>
  activeView: 'LIST' | 'MAP'
  mapPrefetchRef: MutableRefObject<boolean>
  preloadMapView: () => Promise<unknown>
  datasetId: string | null
  radiusMeters: number
  riskMode: RiskMode
  actionFilter: SegmentActionFilter
  includeInferred: boolean
  showZones: boolean
  showIntersectionZones: boolean
  showCrosswalkZones: boolean
  showParkingSpaces: boolean
  markedSpacesOnly: boolean
  hideReportedIllegal: boolean
  showInferredCandidates: boolean
  useMockLocation: boolean
  favoriteAddresses: FavoriteAddress[]
  recentAddressSearches: GeocodeResult[]
  savedPlans: SavedPlan[]
  tripBoardSortMode: TripBoardSortMode
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardFilters: TripBoardFilters
  collapsedSavedPlanGroups: string[]
  recommendationRankMode: AddressRecommendationRankMode
  selectedRouteProfile: RouteProfile
  shareStatus: ShareStatus | null
  setShareStatus: Dispatch<SetStateAction<ShareStatus | null>>
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  datasetHash: string
  datasetHashRef: MutableRefObject<string | null>
  datasetIdRef: MutableRefObject<string | null>
  zoneParamsVersionRef: MutableRefObject<string | number>
  workerClientRef: MutableRefObject<EvaluationWorkerClient | null>
  setClipCacheStats: Dispatch<SetStateAction<ClipCacheStats | null>>
  setEvaluatedSegments: Dispatch<SetStateAction<EvaluatedSegment[]>>
  setEvaluationStatus: Dispatch<SetStateAction<SegmentEvaluationStatus>>
  setSelectedParkingSpaceKeyBySegment: Dispatch<
    SetStateAction<Record<string, string>>
  >
  setSelectedTargetRouteEta: Dispatch<SetStateAction<SegmentRouteEta | null>>
}
