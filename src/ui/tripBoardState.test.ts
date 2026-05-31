import { describe, expect, it } from 'vitest'
import { buildTripBoardState } from './tripBoardState'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
} from './savedPlanTypes'

const formatSavedPlanIntentSummary = (
  counts: Record<SavedPlanIntent, number>,
  unassigned: number,
) => {
  const parts = (['COMMUTE', 'PICKUP', 'BACKUP'] as SavedPlanIntent[])
    .filter((intent) => counts[intent] > 0)
    .map((intent) => `${counts[intent]} ${intent.toLowerCase()}`)
  if (unassigned > 0) {
    parts.push(`${unassigned} unassigned`)
  }
  return parts.join(', ')
}

const createPlan = (overrides: Partial<SavedPlan>): SavedPlan => ({
  key: overrides.url ?? 'plan',
  title: overrides.title ?? 'Plan',
  url: overrides.url ?? 'https://park.example.com/plan',
  datasetId: overrides.datasetId ?? null,
  addressLabel: overrides.addressLabel ?? null,
  segmentName: overrides.segmentName ?? null,
  targetLabel: overrides.targetLabel ?? null,
  createdAt: overrides.createdAt ?? '2026-03-18T00:00:00.000Z',
  pinned: overrides.pinned ?? false,
  ...overrides,
})

describe('tripBoardState', () => {
  it('composes visible, suggestion, group, and comparison state', () => {
    const tripBoardIntentFilterLabels: Record<SavedPlanIntentFilter, string> = {
      ALL: 'All',
      COMMUTE: 'Commute',
      PICKUP: 'Pickup',
      BACKUP: 'Backup',
      UNTAGGED: 'Untagged',
    }
    const tripBoardSuggestionFilterLabels: Record<
      SavedPlanIntentSuggestionFilter,
      string
    > = {
      ALL: 'All',
      SUGGESTED: 'Suggested',
      MANUAL: 'Manual',
    }

    const savedPlans = [
      createPlan({
        url: 'https://park.example.com/a',
        title: 'Plan A',
        addressLabel: 'Home garage',
        allowedAction: 'PARK',
        parkingSpaceCount: 4,
        tier: 'YELLOW',
        walkingDurationSeconds: 120,
        drivingDurationSeconds: 90,
      }),
      createPlan({
        url: 'https://park.example.com/b',
        title: 'Plan B',
        addressLabel: 'Neutral block',
        walkingDurationSeconds: 180,
      }),
    ]

    const state = buildTripBoardState({
      currentShareUrl: 'https://park.example.com/a',
      savedPlans,
      savedPlanConflictUrls: ['https://park.example.com/b'],
      tripBoardSortMode: 'WALK_ETA',
      tripBoardIntentFilter: 'ALL',
      tripBoardSuggestionFilter: 'ALL',
      tripBoardFilters: {
        pinnedOnly: false,
        parkOnly: false,
        markedSpacesOnly: false,
        etaReadyOnly: false,
        conflictedOnly: false,
      },
      tripBoardQuery: '',
      comparedSavedPlanUrls: [
        'https://park.example.com/a',
        'https://park.example.com/b',
      ],
      collapsedSavedPlanGroups: [],
      tripBoardIntentFilterLabels,
      tripBoardSuggestionFilterLabels,
      formatSavedPlanIntentSummary,
      formatSavedPlanComparisonValue: (_label, value) => value,
      maxUntaggedSavedPlanQueue: 2,
    })

    expect(state.currentSavedPlan?.url).toBe('https://park.example.com/a')
    expect(state.visibleConflictedSavedPlans.map((plan) => plan.url)).toEqual([
      'https://park.example.com/b',
    ])
    expect(state.savedPlanComparisonHighlights).toHaveLength(3)
    expect(state.savedPlanMetricLeaders).toHaveLength(3)
    expect(state.compareBoardActionLabel).toBe('Compare visible')
    expect(state.tripBoardStatusSummary).toContain('Showing')
  })
})
