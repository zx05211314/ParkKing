import type { RiskMode } from '../domain/ranking/policy'
import type { ReasonCode } from '../domain/reasons/reasonCodes'
import type { GeocodeResult } from '../map/geocoder'
import type { SegmentReport } from '../feedback/reports'
import type { FavoriteAddress, FavoriteAddressRole } from './recentAddresses'
import type { ActiveFilterChip } from './recommendationDisplayFilters'
import type { NearbySnapshot } from './recommendationDisplaySnapshot'
import type {
  AddressRecommendationCandidate,
  AddressRecommendationRankMode,
} from './addressRecommendations'
import type { AddressRecommendationTarget } from './addressRecommendationTargets'
import type { SegmentActionFilter } from './segmentActionFilter'

export interface SearchAnchor {
  result: GeocodeResult
}

export interface DisplaySegmentLike {
  id: string
  allowedNow: 'PARK' | 'TEMP_STOP' | 'NO_STOP'
  parkingSpaceCount?: number
}

export interface SegmentRouteEta {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export type RouteEtaStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface RecommendationSegmentLike extends AddressRecommendationCandidate {
  reasonCodes?: ReasonCode[]
  reasons?: string[]
}

export type RecommendationTargetLike =
  AddressRecommendationTarget<RecommendationSegmentLike>

export interface UseRecommendationDisplayStateOptions<
  TTarget extends RecommendationTargetLike,
> {
  filterQuery: string
  markedSpacesOnly: boolean
  hideReportedIllegal: boolean
  illegalFeedbackHiddenCount: number
  actionFilter: SegmentActionFilter
  actionFilterHiddenCount: number
  includeInferred: boolean
  radiusMeters: number
  riskMode: RiskMode
  defaultSegmentActionFilter: SegmentActionFilter
  defaultRadiusMeters: number
  defaultRiskMode: RiskMode
  actionFilterLabels: Record<SegmentActionFilter, string>
  riskModeLabels: Record<RiskMode, string>
  favoriteAddresses: FavoriteAddress[]
  searchAnchor: SearchAnchor | null
  addressRecommendationTargets: TTarget[]
  reportsBySegment: Record<string, SegmentReport>
  routeEtaBySegmentId: Record<string, SegmentRouteEta>
  recommendationRankMode: AddressRecommendationRankMode
  routeEtaStatus: RouteEtaStatus
  routeEtaError: string | null
  searchLocation: [number, number] | null
  searchLocationLabel: string | null
  displaySegments: DisplaySegmentLike[]
}

export interface UseRecommendationDisplayStateResult<
  TTarget extends RecommendationTargetLike,
> {
  activeSearchQuery: string
  activeFilterChips: ActiveFilterChip[]
  hasActiveFilters: boolean
  recommendedSegmentIds: string[]
  bestAddressRecommendationTarget: TTarget | null
  bestAddressRecommendation: TTarget['segment'] | null
  alternativeAddressRecommendations: TTarget[]
  addressRecommendationRankingLabel: string
  addressRecommendationFeedbackLabel: string | null
  listSortSummary: string | null
  nearbySnapshot: NearbySnapshot | null
  isPinnedFavorite: boolean
  pinnedFavoriteRole: FavoriteAddressRole | null
  bestAddressRecommendationReason: string | null
  bestAddressRecommendationReport: SegmentReport | null
  bestAddressRecommendationFeedback: string | null
  emptySegmentsMessage: string
  addressRecommendationEmptyMessage: string
}
