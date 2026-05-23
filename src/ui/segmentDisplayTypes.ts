import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import type { ReportStatus } from '../feedback/reports'
import type { AddressRecommendationTarget } from './addressRecommendationTargets'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SegmentListItem } from './segmentListTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { EvaluatedSegment } from './types'
import type { RiskMode } from '../domain/ranking/policy'

export interface RouteEtaLike {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export interface RecommendationSortableSegment extends SegmentListItem {
  reportStatus: ReportStatus | null
}

export interface UseSegmentDisplayStateOptions {
  evaluatedSegments: EvaluatedSegment[]
  activeDistanceLocation: [number, number] | null
  includeInferred: boolean
  radiusMeters: number
  riskMode: RiskMode
  hideReportedIllegal: boolean
  reportsBySegment: Record<
    string,
    {
      status: ReportStatus
    }
  >
  actionFilter: SegmentActionFilter
  markedSpacesOnly: boolean
  deferredFilterQuery: string
  filterQuery: string
  searchLocation: [number, number] | null
  recommendationRankMode: AddressRecommendationRankMode
  routeEtaBySegmentId: Record<string, RouteEtaLike>
  parkingSpaces: ParkingSpaceCollection
  navigationOrigin: [number, number] | null
  selectedParkingSpaceKeyBySegment: Record<string, string>
}

export interface UseSegmentDisplayStateResult {
  segmentsWithDistance: SegmentListItem[]
  illegalFeedbackHiddenCount: number
  actionFilterHiddenCount: number
  actionFilteredMarkedSpaceSegmentCount: number
  filteredSegments: SegmentListItem[]
  segmentFilterSuggestions: SegmentListItem[]
  recommendationSortableSegments: RecommendationSortableSegment[]
  addressRecommendationCandidates: RecommendationSortableSegment[]
  addressRecommendationTargets: AddressRecommendationTarget<RecommendationSortableSegment>[]
  displaySegments: SegmentListItem[]
  displaySegmentTotalCount: number
  displaySegmentLimit: number
}
