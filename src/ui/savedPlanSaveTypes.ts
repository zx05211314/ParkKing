import type { RouteProfile } from '../map/routing'
import type { AllowedAction, Tier } from './types'

export interface SavedPlanShareSegment {
  id: string
  name: string
  allowedNow: AllowedAction
  parkingSpaceCount?: number
  tier: Tier
}

export interface SavedPlanShareTarget {
  targetKey: string | null
  targetLabel: string | null
}

export interface SavedPlanSelectionOptions {
  selectedId: string
  targetKey?: string | null
  title: string
  segmentName: string | null
  targetLabel: string | null
  routeProfile?: RouteProfile
  walkingDurationSeconds?: number | null
  walkingEstimated?: boolean
  drivingDurationSeconds?: number | null
  drivingEstimated?: boolean
  allowedAction?: AllowedAction
  parkingSpaceCount?: number | null
  tier?: Tier
}
