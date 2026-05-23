import { describe, expect, it } from 'vitest'
import {
  formatSavedPlanComparisonValue,
  formatSavedPlanIntentSummary,
  getSavedPlanEtaSummary,
  getSavedPlanQualitySummary,
  getSavedPlanSettingChips,
  rankModeToRouteProfile,
  RECOMMENDATION_RANK_MODE_LABELS,
  RISK_MODE_LABELS,
  ROUTE_PROFILE_LABELS,
  TIME_MODE_LABELS,
  TRIP_BOARD_FILTER_LABELS,
  TRIP_BOARD_INTENT_FILTER_LABELS,
  TRIP_BOARD_SORT_MODE_LABELS,
  TRIP_BOARD_SUGGESTION_FILTER_LABELS,
} from './appPresentationConfig'
import type { SavedPlan } from './savedPlanTypes'

describe('appPresentationConfig', () => {
  it('keeps the public label maps and route profile mapping stable', () => {
    expect(RECOMMENDATION_RANK_MODE_LABELS.WALK).toBe('Walk')
    expect(RISK_MODE_LABELS.NEUTRAL).toBe('Neutral')
    expect(ROUTE_PROFILE_LABELS.walking).toBe('Walk route')
    expect(TIME_MODE_LABELS.NIGHT).toBe('Night')
    expect(TRIP_BOARD_SORT_MODE_LABELS.QUALITY).toBe('Parking quality')
    expect(TRIP_BOARD_FILTER_LABELS.conflictedOnly).toBe('Conflicts only')
    expect(TRIP_BOARD_INTENT_FILTER_LABELS.UNTAGGED).toBe('Untagged')
    expect(TRIP_BOARD_SUGGESTION_FILTER_LABELS.MANUAL).toBe('Manual only')
    expect(rankModeToRouteProfile('WALK')).toBe('walking')
    expect(rankModeToRouteProfile('DISTANCE')).toBeNull()
  })

  it('formats saved-plan display helpers through the facade', () => {
    const plan: SavedPlan = {
      key: 'plan-1',
      url: 'https://example.com/plan',
      title: 'Commute',
      datasetId: 'taipei',
      addressLabel: 'City Hall',
      segmentName: 'City Hall North',
      targetLabel: 'Space 7',
      createdAt: '2026-03-20T00:00:00Z',
      intent: 'COMMUTE',
      recommendationRankMode: 'WALK',
      routeProfile: 'walking',
      riskMode: 'NEUTRAL',
      mode: 'NIGHT',
      radiusMeters: 600,
      actionFilter: 'PARK_ONLY',
      allowedAction: 'PARK',
      parkingSpaceCount: 4,
      tier: 'GREEN',
      walkingDurationSeconds: 300,
      walkingEstimated: false,
      drivingDurationSeconds: 180,
      drivingEstimated: true,
      pinned: false,
    }

    expect(getSavedPlanSettingChips(plan)).toContain('Intent Commute')
    expect(getSavedPlanEtaSummary(plan)).toEqual(['Walk 5 min', 'Drive ~3 min'])
    expect(getSavedPlanQualitySummary(plan)).toEqual(['PARK', 'Spaces 4', 'GREEN'])
    expect(formatSavedPlanComparisonValue('Risk', 'NEUTRAL')).toBe('Neutral')
    expect(formatSavedPlanIntentSummary({ COMMUTE: 2, PICKUP: 1, BACKUP: 0 }, 3)).toBe(
      '2 commute, 1 pickup, 3 untagged',
    )
  })
})
