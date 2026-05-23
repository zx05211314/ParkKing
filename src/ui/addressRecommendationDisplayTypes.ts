import type { AllowedAction, Tier } from './types'
import type { ReasonCode } from '../domain/reasons/reasonCodes'

export interface SegmentRouteEtaLike {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export interface RecommendationSegmentLike {
  id: string
  name: string
  tier: Tier | string
  allowedNow: AllowedAction | string
  dataFreshnessDays?: number | null
  sourceType?: string | null
  distanceMeters?: number
  parkingSpaceCount?: number
  reasonCodes?: ReasonCode[] | null
  reasons?: string[] | null
}

export interface RecommendationTargetLike {
  rank: number
  segment: RecommendationSegmentLike
  targetKey: string | null
  targetKind: 'SEGMENT' | 'PARKING_SPACE'
  targetLabel: string
  targetMetadata: string[]
  destination: [number, number] | null
  description: string | null
}

export interface NavigationLinksLike {
  walking: string
  driving: string
}

export type RouteEtaStatus = 'idle' | 'loading' | 'ready' | 'error'
