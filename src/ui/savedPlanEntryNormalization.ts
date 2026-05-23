import { readSharedAppState } from './shareState'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { RouteProfile } from '../map/routing'
import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { AllowedAction, Tier } from './types'
import { isSavedPlanIntent, type SavedPlan } from './savedPlanTypes'

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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

const normalizeRadiusMeters = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return Math.round(value)
}

const normalizeDurationSeconds = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return Math.round(value)
}

const normalizeCount = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return Math.round(value)
}

const readSavedPlanStateFromUrl = (url: string) => {
  try {
    const parsed = new URL(url, 'https://parkking.local')
    return readSharedAppState(parsed.search)
  } catch {
    return null
  }
}

export const normalizeSavedPlanValue = (value: unknown): SavedPlan | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<SavedPlan>
  const url = normalizeText(candidate.url)
  const title = normalizeText(candidate.title)
  const createdAt = normalizeText(candidate.createdAt)
  if (!url || !title || !createdAt) {
    return null
  }
  const sharedState = readSavedPlanStateFromUrl(url)
  const recommendationRankMode = isRecommendationRankMode(candidate.recommendationRankMode)
    ? candidate.recommendationRankMode
    : sharedState?.recommendationRankMode ?? undefined
  const routeProfile = isRouteProfile(candidate.routeProfile)
    ? candidate.routeProfile
    : sharedState?.routeProfile ?? undefined
  const riskMode = isRiskMode(candidate.riskMode)
    ? candidate.riskMode
    : sharedState?.riskMode ?? undefined
  const mode = isTimeMode(candidate.mode) ? candidate.mode : sharedState?.mode ?? undefined
  const radiusMeters =
    normalizeRadiusMeters(candidate.radiusMeters) ??
    normalizeRadiusMeters(sharedState?.radiusMeters ?? undefined)
  const actionFilter = isSegmentActionFilter(candidate.actionFilter)
    ? candidate.actionFilter
    : sharedState?.actionFilter ?? undefined
  const walkingDurationSeconds = normalizeDurationSeconds(candidate.walkingDurationSeconds)
  const drivingDurationSeconds = normalizeDurationSeconds(candidate.drivingDurationSeconds)
  const walkingEstimated =
    typeof candidate.walkingEstimated === 'boolean'
      ? candidate.walkingEstimated
      : undefined
  const drivingEstimated =
    typeof candidate.drivingEstimated === 'boolean'
      ? candidate.drivingEstimated
      : undefined
  const allowedAction = isAllowedAction(candidate.allowedAction)
    ? candidate.allowedAction
    : undefined
  const parkingSpaceCount = normalizeCount(candidate.parkingSpaceCount)
  const tier = isTier(candidate.tier) ? candidate.tier : undefined
  const intent = isSavedPlanIntent(candidate.intent) ? candidate.intent : undefined

  return {
    key: url,
    title,
    url,
    datasetId: normalizeText(candidate.datasetId),
    addressLabel: normalizeText(candidate.addressLabel),
    segmentName: normalizeText(candidate.segmentName),
    targetLabel: normalizeText(candidate.targetLabel),
    createdAt,
    pinned: candidate.pinned === true,
    ...(recommendationRankMode ? { recommendationRankMode } : {}),
    ...(routeProfile ? { routeProfile } : {}),
    ...(riskMode ? { riskMode } : {}),
    ...(mode ? { mode } : {}),
    ...(radiusMeters !== undefined ? { radiusMeters } : {}),
    ...(actionFilter ? { actionFilter } : {}),
    ...(walkingDurationSeconds !== undefined ? { walkingDurationSeconds } : {}),
    ...(walkingEstimated !== undefined ? { walkingEstimated } : {}),
    ...(drivingDurationSeconds !== undefined ? { drivingDurationSeconds } : {}),
    ...(drivingEstimated !== undefined ? { drivingEstimated } : {}),
    ...(allowedAction ? { allowedAction } : {}),
    ...(parkingSpaceCount !== undefined ? { parkingSpaceCount } : {}),
    ...(tier ? { tier } : {}),
    ...(intent ? { intent } : {}),
  }
}
