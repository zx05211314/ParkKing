import { describe, expect, it } from 'vitest'
import { buildTripBoardGroupState } from './tripBoardGroupState'
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

describe('tripBoardGroupState', () => {
  it('builds grouped state and status summary with collapsed groups', () => {
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

    const orderedSavedPlans = [
      createPlan({ url: 'https://park.example.com/a', datasetId: 'xinyi', intent: 'COMMUTE' }),
      createPlan({ url: 'https://park.example.com/b', datasetId: 'xinyi' }),
      createPlan({ url: 'https://park.example.com/c', datasetId: 'daan' }),
    ]

    const state = buildTripBoardGroupState({
      orderedSavedPlans,
      visibleSavedPlans: orderedSavedPlans,
      savedPlansCount: orderedSavedPlans.length,
      collapsedSavedPlanGroups: ['xinyi'],
      tripBoardIntentFilter: 'UNTAGGED',
      tripBoardSuggestionFilter: 'SUGGESTED',
      tripBoardIntentFilterLabels,
      tripBoardSuggestionFilterLabels,
      visibleSavedPlanIntentSummary: {
        COMMUTE: 1,
        PICKUP: 0,
        BACKUP: 0,
        taggedCount: 1,
        unassignedCount: 2,
      },
      formatSavedPlanIntentSummary,
    })

    expect(state.visibleSavedPlanGroups).toHaveLength(2)
    expect(state.visibleSavedPlanGroupKeys).toEqual(['xinyi', 'daan'])
    expect(state.hasCollapsedVisibleSavedPlanGroups).toBe(true)
    expect(state.hasExpandedVisibleSavedPlanGroups).toBe(true)
    expect(state.hiddenCollapsedSavedPlanCount).toBe(2)
    expect(state.tripBoardStatusSummary).toBe(
      'Showing 1 of 3 saved plans. across 1 of 2 groups. 2 hidden in collapsed groups. intent Untagged. review suggested. visible intents 1 commute, 2 unassigned.',
    )
  })
})
