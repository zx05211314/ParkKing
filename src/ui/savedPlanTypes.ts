import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { RouteProfile } from '../map/routing'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { AllowedAction, Tier } from './types'

export const DEFAULT_SAVED_PLAN_LIMIT = 8

export type TripBoardSortMode = 'RECENT' | 'WALK_ETA' | 'DRIVE_ETA' | 'QUALITY'
export type SavedPlanIntent = 'COMMUTE' | 'PICKUP' | 'BACKUP'
export type SavedPlanIntentFilter = SavedPlanIntent | 'ALL' | 'UNTAGGED'
export type SavedPlanIntentSuggestionFilter = 'ALL' | 'SUGGESTED' | 'MANUAL'

export const SAVED_PLAN_INTENT_LABELS: Record<SavedPlanIntent, string> = {
  COMMUTE: 'Commute',
  PICKUP: 'Pickup',
  BACKUP: 'Backup',
}

export const SAVED_PLAN_INTENTS = Object.keys(
  SAVED_PLAN_INTENT_LABELS,
) as SavedPlanIntent[]

export interface TripBoardFilters {
  pinnedOnly: boolean
  parkOnly: boolean
  markedSpacesOnly: boolean
  etaReadyOnly: boolean
  conflictedOnly?: boolean
}

export const DEFAULT_TRIP_BOARD_FILTERS: TripBoardFilters = {
  pinnedOnly: false,
  parkOnly: false,
  markedSpacesOnly: false,
  etaReadyOnly: false,
  conflictedOnly: false,
}

export interface SavedPlan {
  key: string
  title: string
  url: string
  datasetId: string | null
  addressLabel: string | null
  segmentName: string | null
  targetLabel: string | null
  createdAt: string
  pinned?: boolean
  intent?: SavedPlanIntent
  recommendationRankMode?: AddressRecommendationRankMode
  routeProfile?: RouteProfile
  riskMode?: RiskMode
  mode?: TimeMode
  radiusMeters?: number
  actionFilter?: SegmentActionFilter
  walkingDurationSeconds?: number
  walkingEstimated?: boolean
  drivingDurationSeconds?: number
  drivingEstimated?: boolean
  allowedAction?: AllowedAction
  parkingSpaceCount?: number
  tier?: Tier
}

export interface SavedPlanGroup {
  key: string | null
  plans: SavedPlan[]
  count: number
  pinnedCount: number
}

export interface SavedPlanIntentGroup {
  intent: SavedPlanIntent
  plans: SavedPlan[]
  count: number
  leader: SavedPlan
}

export interface SavedPlanComparisonRow {
  label: string
  left: string
  right: string
  same: boolean
}

export interface SavedPlanComparisonHighlight {
  label: string
  winner: 'left' | 'right'
  summary: string
}

export interface SavedPlanMetricLeader {
  key: 'WALK_ETA' | 'DRIVE_ETA' | 'QUALITY'
  label: string
  plan: SavedPlan
}

export interface SavedPlanSummary {
  totalCount: number
  pinnedCount: number
  parkReadyCount: number
  etaReadyCount: number
  markedSpaceCount: number
}

export interface SavedPlanConflictMergeResult {
  plans: SavedPlan[]
  conflictedUrls: string[]
  conflictDetails: SavedPlanConflictDetail[]
}

export interface SavedPlanConflictFieldDetail {
  label: string
  keptValue: string
  sharedValue: string
}

export interface SavedPlanConflictDetail {
  url: string
  fields: SavedPlanConflictFieldDetail[]
  sharedPlan: SavedPlan
}

export interface SavedPlanIntentSummary {
  COMMUTE: number
  PICKUP: number
  BACKUP: number
  taggedCount: number
  unassignedCount: number
}

export interface SavedPlanIntentSuggestionFilterSummary {
  ALL: number
  SUGGESTED: number
  MANUAL: number
}

export interface SavedPlanIntentSuggestion {
  intent: SavedPlanIntent
  reason: string
}

export interface SavedPlanIntentSuggestionAssignment
  extends SavedPlanIntentSuggestion {
  url: string
}

export interface SavedPlanIntentSuggestionSummary {
  totalCount: number
  COMMUTE: number
  PICKUP: number
  BACKUP: number
}

export const isSavedPlanIntent = (value: unknown): value is SavedPlanIntent =>
  value === 'COMMUTE' || value === 'PICKUP' || value === 'BACKUP'
