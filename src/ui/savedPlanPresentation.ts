import { formatEtaDuration, getAllowedActionLabel } from './displayFormatting'
import {
  SAVED_PLAN_INTENT_LABELS,
  SAVED_PLAN_INTENTS,
  isSavedPlanIntent,
  type SavedPlan,
  type SavedPlanIntent,
} from './savedPlanTypes'
import {
  DEFAULT_SEGMENT_ACTION_FILTER,
  SEGMENT_ACTION_FILTER_LABELS,
  isSegmentActionFilter,
} from './segmentActionFilter'
import {
  isRecommendationRankMode,
  isRiskMode,
  isRouteProfile,
  RECOMMENDATION_RANK_MODE_LABELS,
  RISK_MODE_LABELS,
  ROUTE_PROFILE_LABELS,
  TIME_MODE_LABELS,
} from './appPresentationLabels'

export const getSavedPlanSettingChips = (plan: SavedPlan) => {
  const chips: string[] = []
  if (plan.intent) {
    chips.push(`Intent ${SAVED_PLAN_INTENT_LABELS[plan.intent]}`)
  }
  if (plan.recommendationRankMode) {
    chips.push(`Rank ${RECOMMENDATION_RANK_MODE_LABELS[plan.recommendationRankMode]}`)
  }
  if (plan.routeProfile) {
    chips.push(ROUTE_PROFILE_LABELS[plan.routeProfile])
  }
  if (plan.riskMode) {
    chips.push(`Risk ${RISK_MODE_LABELS[plan.riskMode]}`)
  }
  if (plan.mode) {
    chips.push(`Time ${TIME_MODE_LABELS[plan.mode]}`)
  }
  if (typeof plan.radiusMeters === 'number') {
    chips.push(`Radius ${plan.radiusMeters} m`)
  }
  if (plan.actionFilter && plan.actionFilter !== DEFAULT_SEGMENT_ACTION_FILTER) {
    chips.push(`Action ${SEGMENT_ACTION_FILTER_LABELS[plan.actionFilter]}`)
  }
  return chips
}

export const getSavedPlanEtaSummary = (plan: SavedPlan) => {
  const parts: string[] = []
  if (typeof plan.walkingDurationSeconds === 'number') {
    parts.push(
      `${plan.walkingEstimated ? 'Walk ~' : 'Walk '}${formatEtaDuration(plan.walkingDurationSeconds)}`,
    )
  }
  if (typeof plan.drivingDurationSeconds === 'number') {
    parts.push(
      `${plan.drivingEstimated ? 'Drive ~' : 'Drive '}${formatEtaDuration(plan.drivingDurationSeconds)}`,
    )
  }
  return parts
}

export const getSavedPlanQualitySummary = (plan: SavedPlan) => {
  const parts: string[] = []
  if (plan.allowedAction) {
    parts.push(getAllowedActionLabel(plan.allowedAction))
  }
  if (typeof plan.parkingSpaceCount === 'number' && plan.parkingSpaceCount > 0) {
    parts.push(`Spaces ${plan.parkingSpaceCount}`)
  }
  if (plan.tier) {
    parts.push(plan.tier)
  }
  return parts
}

export const formatSavedPlanComparisonValue = (label: string, value: string) => {
  if (value === '-') {
    return value
  }

  if (label === 'Intent' && isSavedPlanIntent(value)) {
    return SAVED_PLAN_INTENT_LABELS[value]
  }
  if (label === 'Rank' && isRecommendationRankMode(value)) {
    return RECOMMENDATION_RANK_MODE_LABELS[value]
  }
  if (label === 'Route' && isRouteProfile(value)) {
    return ROUTE_PROFILE_LABELS[value]
  }
  if (label === 'Risk' && isRiskMode(value)) {
    return RISK_MODE_LABELS[value]
  }
  if (label === 'Time' && (value === 'NOW' || value === 'NIGHT')) {
    return TIME_MODE_LABELS[value]
  }
  if (label === 'Action' && isSegmentActionFilter(value)) {
    return SEGMENT_ACTION_FILTER_LABELS[value]
  }
  if (label === 'Legality' && (value === 'PARK' || value === 'TEMP_STOP' || value === 'NO_STOP')) {
    return getAllowedActionLabel(value)
  }
  if (label === 'Tier' && (value === 'GREEN' || value === 'YELLOW' || value === 'RED')) {
    return value.charAt(0) + value.slice(1).toLowerCase()
  }

  return value
}

export const formatSavedPlanIntentSummary = (
  counts: Record<SavedPlanIntent, number>,
  unassigned: number,
) => {
  const parts = SAVED_PLAN_INTENTS.flatMap((intent) =>
    counts[intent] > 0
      ? [`${counts[intent]} ${SAVED_PLAN_INTENT_LABELS[intent].toLowerCase()}`]
      : [],
  )

  if (unassigned > 0) {
    parts.push(`${unassigned} untagged`)
  }

  return parts.join(', ')
}

export const formatSuggestionActionLabel = (intent: SavedPlanIntent, count: number) =>
  `Auto ${SAVED_PLAN_INTENT_LABELS[intent]} (${count})`
