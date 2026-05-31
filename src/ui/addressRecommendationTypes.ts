import type { ReportStatus } from '../feedback/reports'
import type { AllowedAction } from './types'

export const DEFAULT_ADDRESS_RECOMMENDATION_LIMIT = 3
export const DEFAULT_ADDRESS_RECOMMENDATION_CANDIDATE_LIMIT = 8

export type AddressRecommendationRankMode = 'WALK' | 'DRIVE' | 'DISTANCE'

export interface AddressRecommendationCandidate {
  id: string
  path: [number, number][]
  distanceMeters?: number
  rankScore?: number
  parkingSpaceCount?: number
  reportStatus?: ReportStatus | null
  allowedNow?: AllowedAction | null
}

export interface AddressRecommendationRouteEta {
  walkingDurationSeconds: number | null
  walkingDistanceMeters: number | null
  walkingEstimated: boolean
  drivingDurationSeconds?: number | null
  drivingDistanceMeters?: number | null
  drivingEstimated?: boolean
}

export interface AddressRecommendation<T extends AddressRecommendationCandidate> {
  rank: number
  segment: T
}

export interface AddressRecommendationOptions {
  limit?: number
  routeEtaBySegmentId?: Record<string, AddressRecommendationRouteEta>
  rankMode?: AddressRecommendationRankMode
}

export interface AddressRecommendationCandidateOptions {
  limit?: number
}
