import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { RouteProfile } from '../map/routing'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { AllowedAction, Tier } from './types'
import {
  SAVED_PLAN_INTENT_LABELS,
  isSavedPlanIntent,
  type SavedPlan,
} from './savedPlanTypes'

export const SAVED_PLAN_CONFLICT_FIELD_LABELS = {
  title: 'Title',
  datasetId: 'District',
  addressLabel: 'Address',
  segmentName: 'Segment',
  targetLabel: 'Target',
  pinned: 'Pinned',
  intent: 'Intent',
  recommendationRankMode: 'Rank',
  routeProfile: 'Route',
  riskMode: 'Risk',
  mode: 'Time',
  radiusMeters: 'Radius',
  actionFilter: 'Action',
  allowedAction: 'Legality',
  parkingSpaceCount: 'Spaces',
  tier: 'Tier',
} as const

export type SavedPlanConflictFieldKey = keyof typeof SAVED_PLAN_CONFLICT_FIELD_LABELS

const SAVED_PLAN_RANK_MODE_LABELS: Record<AddressRecommendationRankMode, string> = {
  WALK: 'Walk',
  DRIVE: 'Drive',
  DISTANCE: 'Distance',
}

const SAVED_PLAN_ROUTE_PROFILE_LABELS: Record<RouteProfile, string> = {
  walking: 'Walking',
  driving: 'Driving',
}

const SAVED_PLAN_RISK_MODE_LABELS: Record<RiskMode, string> = {
  CONSERVATIVE: 'Conservative',
  NEUTRAL: 'Neutral',
  AGGRESSIVE: 'Aggressive',
}

const SAVED_PLAN_TIME_MODE_LABELS: Record<TimeMode, string> = {
  NOW: 'Now',
  NIGHT: 'Night',
}

const SAVED_PLAN_ACTION_FILTER_LABELS: Record<SegmentActionFilter, string> = {
  ALL: 'All actions',
  PARK_ONLY: 'Park ok only',
  STOP_OK: 'Stop ok',
}

const SAVED_PLAN_ALLOWED_ACTION_LABELS: Record<AllowedAction, string> = {
  PARK: 'Park ok',
  TEMP_STOP: 'Stop ok',
  NO_STOP: 'No stop',
}

const SAVED_PLAN_TIER_LABELS: Record<Tier, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
}

const isRecommendationRankMode = (
  value: unknown,
): value is AddressRecommendationRankMode =>
  value === 'WALK' || value === 'DRIVE' || value === 'DISTANCE'

const isRouteProfile = (value: unknown): value is RouteProfile =>
  value === 'walking' || value === 'driving'

const isRiskMode = (value: unknown): value is RiskMode =>
  value === 'CONSERVATIVE' || value === 'NEUTRAL' || value === 'AGGRESSIVE'

const isTimeMode = (value: unknown): value is TimeMode =>
  value === 'NOW' || value === 'NIGHT'

const isSegmentActionFilter = (value: unknown): value is SegmentActionFilter =>
  value === 'ALL' || value === 'PARK_ONLY' || value === 'STOP_OK'

const isAllowedAction = (value: unknown): value is AllowedAction =>
  value === 'PARK' || value === 'TEMP_STOP' || value === 'NO_STOP'

const isTier = (value: unknown): value is Tier =>
  value === 'GREEN' || value === 'YELLOW' || value === 'RED'

export const getSavedPlanConflictComparableValues = (plan: SavedPlan) => ({
  title: plan.title,
  datasetId: plan.datasetId,
  addressLabel: plan.addressLabel,
  segmentName: plan.segmentName,
  targetLabel: plan.targetLabel,
  pinned: Boolean(plan.pinned),
  intent: plan.intent ?? null,
  recommendationRankMode: plan.recommendationRankMode ?? null,
  routeProfile: plan.routeProfile ?? null,
  riskMode: plan.riskMode ?? null,
  mode: plan.mode ?? null,
  radiusMeters: plan.radiusMeters ?? null,
  actionFilter: plan.actionFilter ?? null,
  allowedAction: plan.allowedAction ?? null,
  parkingSpaceCount: plan.parkingSpaceCount ?? null,
  tier: plan.tier ?? null,
})

export const formatSavedPlanConflictValue = (
  fieldKey: SavedPlanConflictFieldKey,
  value: unknown,
) => {
  switch (fieldKey) {
    case 'pinned':
      return value ? 'Pinned' : 'Not pinned'
    case 'intent':
      return isSavedPlanIntent(value) ? SAVED_PLAN_INTENT_LABELS[value] : 'None'
    case 'recommendationRankMode':
      return isRecommendationRankMode(value)
        ? SAVED_PLAN_RANK_MODE_LABELS[value]
        : 'Not set'
    case 'routeProfile':
      return isRouteProfile(value) ? SAVED_PLAN_ROUTE_PROFILE_LABELS[value] : 'Not set'
    case 'riskMode':
      return isRiskMode(value) ? SAVED_PLAN_RISK_MODE_LABELS[value] : 'Not set'
    case 'mode':
      return isTimeMode(value) ? SAVED_PLAN_TIME_MODE_LABELS[value] : 'Not set'
    case 'radiusMeters':
      return typeof value === 'number' ? `${value} m` : 'Not set'
    case 'actionFilter':
      return isSegmentActionFilter(value)
        ? SAVED_PLAN_ACTION_FILTER_LABELS[value]
        : 'Not set'
    case 'allowedAction':
      return isAllowedAction(value) ? SAVED_PLAN_ALLOWED_ACTION_LABELS[value] : 'Unknown'
    case 'parkingSpaceCount':
      return typeof value === 'number'
        ? `${value} space${value === 1 ? '' : 's'}`
        : 'None'
    case 'tier':
      return isTier(value) ? SAVED_PLAN_TIER_LABELS[value] : 'Unknown'
    default:
      return typeof value === 'string' && value.length > 0 ? value : 'None'
  }
}
