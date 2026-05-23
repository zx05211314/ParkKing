import type { RiskMode } from '../domain/ranking/policy'
import type { TimeMode } from '../domain/rules/time'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SavedPlan } from './savedPlanTypes'
import type { SegmentActionFilter } from './segmentActionFilter'
import type { AllowedAction, Tier } from './types'

export interface SavedPlanRouteEtaSummary {
  walkingDurationSeconds: number | null
  walkingEstimated?: boolean
  drivingDurationSeconds: number | null
  drivingEstimated?: boolean
}

interface BuildSavedPlanEntryOptions {
  title: string
  url: string
  datasetId: string | null
  addressLabel: string | null
  segmentName: string | null
  targetLabel: string | null
  recommendationRankMode: AddressRecommendationRankMode
  routeProfile: RouteProfile
  riskMode: RiskMode
  mode: TimeMode
  radiusMeters: number
  actionFilter: SegmentActionFilter
  routeEta?: SavedPlanRouteEtaSummary | null
  allowedAction?: AllowedAction
  parkingSpaceCount?: number | null
  tier?: Tier
  createdAt?: string
}

export const buildSavedPlanRouteEtaFields = (
  routeEta: SavedPlanRouteEtaSummary | null | undefined,
) => ({
  ...(routeEta?.walkingDurationSeconds !== null && routeEta?.walkingDurationSeconds !== undefined
    ? { walkingDurationSeconds: routeEta.walkingDurationSeconds }
    : {}),
  ...(routeEta?.walkingEstimated !== undefined
    ? { walkingEstimated: routeEta.walkingEstimated }
    : {}),
  ...(routeEta?.drivingDurationSeconds !== null && routeEta?.drivingDurationSeconds !== undefined
    ? { drivingDurationSeconds: routeEta.drivingDurationSeconds }
    : {}),
  ...(routeEta?.drivingEstimated !== undefined
    ? { drivingEstimated: routeEta.drivingEstimated }
    : {}),
})

export const buildSavedPlanEntry = ({
  title,
  url,
  datasetId,
  addressLabel,
  segmentName,
  targetLabel,
  recommendationRankMode,
  routeProfile,
  riskMode,
  mode,
  radiusMeters,
  actionFilter,
  routeEta,
  allowedAction,
  parkingSpaceCount,
  tier,
  createdAt = new Date().toISOString(),
}: BuildSavedPlanEntryOptions): Omit<SavedPlan, 'key'> => ({
  title,
  url,
  datasetId,
  addressLabel,
  segmentName,
  targetLabel,
  createdAt,
  recommendationRankMode,
  routeProfile,
  riskMode,
  mode,
  radiusMeters,
  actionFilter,
  ...buildSavedPlanRouteEtaFields(routeEta),
  ...(allowedAction ? { allowedAction } : {}),
  ...(parkingSpaceCount !== null && parkingSpaceCount !== undefined
    ? { parkingSpaceCount }
    : {}),
  ...(tier ? { tier } : {}),
})

export const buildSavedPlanCurrentTitle = (
  selectedSegmentName: string | null | undefined,
  searchLocationLabel: string | null,
  filterQuery: string,
) =>
  selectedSegmentName ??
  searchLocationLabel ??
  (filterQuery.trim().length > 0 ? `Filtered: ${filterQuery.trim()}` : 'Saved parking view')
