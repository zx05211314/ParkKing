import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import {
  SAVED_PLAN_INTENT_LABELS,
  isSavedPlanIntent,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionFilter,
  type TripBoardFilters,
  type TripBoardSortMode,
} from './savedPlanTypes'

export type TripBoardIntentFilter = SavedPlanIntentFilter
export type TripBoardSuggestionFilter = SavedPlanIntentSuggestionFilter

export const RISK_MODE_LABELS: Record<RiskMode, string> = {
  CONSERVATIVE: 'Conservative',
  NEUTRAL: 'Neutral',
  AGGRESSIVE: 'Aggressive',
}

export const RECOMMENDATION_RANK_MODE_LABELS: Record<
  AddressRecommendationRankMode,
  string
> = {
  WALK: 'Walk',
  DRIVE: 'Drive',
  DISTANCE: 'Distance',
}

export const ROUTE_PROFILE_LABELS: Record<RouteProfile, string> = {
  walking: 'Walk route',
  driving: 'Drive route',
}

export const TRIP_BOARD_SORT_MODE_LABELS: Record<TripBoardSortMode, string> = {
  RECENT: 'Recent',
  WALK_ETA: 'Walk ETA',
  DRIVE_ETA: 'Drive ETA',
  QUALITY: 'Parking quality',
}

export const TRIP_BOARD_FILTER_LABELS: Record<keyof TripBoardFilters, string> = {
  pinnedOnly: 'Pinned only',
  parkOnly: 'Park ok only',
  markedSpacesOnly: 'Has marked spaces',
  etaReadyOnly: 'ETA ready',
  conflictedOnly: 'Conflicts only',
}

export const TRIP_BOARD_INTENT_FILTER_LABELS: Record<TripBoardIntentFilter, string> = {
  ALL: 'All intents',
  UNTAGGED: 'Untagged',
  ...SAVED_PLAN_INTENT_LABELS,
}

export const TRIP_BOARD_SUGGESTION_FILTER_LABELS: Record<
  TripBoardSuggestionFilter,
  string
> = {
  ALL: 'All untagged',
  SUGGESTED: 'Suggested only',
  MANUAL: 'Manual only',
}

export const TIME_MODE_LABELS: Record<TimeMode, string> = {
  NOW: 'Now',
  NIGHT: 'Night',
}

export const isRiskMode = (value: unknown): value is RiskMode => {
  return value === 'CONSERVATIVE' || value === 'NEUTRAL' || value === 'AGGRESSIVE'
}

export const isRecommendationRankMode = (
  value: unknown,
): value is AddressRecommendationRankMode => {
  return value === 'WALK' || value === 'DRIVE' || value === 'DISTANCE'
}

export const isRouteProfile = (value: unknown): value is RouteProfile => {
  return value === 'walking' || value === 'driving'
}

export const isTripBoardSortMode = (value: unknown): value is TripBoardSortMode => {
  return (
    value === 'RECENT' ||
    value === 'WALK_ETA' ||
    value === 'DRIVE_ETA' ||
    value === 'QUALITY'
  )
}

export const isTripBoardIntentFilter = (
  value: unknown,
): value is TripBoardIntentFilter =>
  value === 'ALL' || value === 'UNTAGGED' || isSavedPlanIntent(value)

export const isTripBoardSuggestionFilter = (
  value: unknown,
): value is TripBoardSuggestionFilter =>
  value === 'ALL' || value === 'SUGGESTED' || value === 'MANUAL'

export const rankModeToRouteProfile = (
  value: AddressRecommendationRankMode,
): RouteProfile | null => {
  if (value === 'WALK') {
    return 'walking'
  }
  if (value === 'DRIVE') {
    return 'driving'
  }
  return null
}
