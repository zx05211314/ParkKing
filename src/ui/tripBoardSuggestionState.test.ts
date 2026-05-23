import { describe, expect, it } from 'vitest'
import { buildTripBoardSuggestionState } from './tripBoardSuggestionState'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'

const formatSavedPlanIntentSummary = (counts: Record<SavedPlanIntent, number>) =>
  (['COMMUTE', 'PICKUP', 'BACKUP'] as SavedPlanIntent[])
    .filter((intent) => counts[intent] > 0)
    .map((intent) => `${counts[intent]} ${intent.toLowerCase()}`)
    .join(', ')

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

describe('tripBoardSuggestionState', () => {
  it('builds visible suggestion queues and summary text', () => {
    const state = buildTripBoardSuggestionState({
      visibleSavedPlans: [
        createPlan({
          url: 'https://park.example.com/a',
          title: 'Commute option',
          addressLabel: 'Home garage',
        }),
        createPlan({
          url: 'https://park.example.com/b',
          title: 'Manual option',
          addressLabel: 'Neutral block',
        }),
        createPlan({
          url: 'https://park.example.com/c',
          title: 'Tagged option',
          intent: 'BACKUP',
        }),
      ],
      maxUntaggedSavedPlanQueue: 1,
      formatSavedPlanIntentSummary,
    })

    expect(state.visibleUntaggedSavedPlans.map((plan) => plan.url)).toEqual([
      'https://park.example.com/a',
      'https://park.example.com/b',
    ])
    expect(state.visibleUntaggedSavedPlanSuggestions.map((assignment) => assignment.url)).toEqual([
      'https://park.example.com/a',
    ])
    expect(state.visibleSuggestedUntaggedSavedPlanQueue.map((plan) => plan.url)).toEqual([
      'https://park.example.com/a',
    ])
    expect(state.visibleManualUntaggedSavedPlanQueue.map((plan) => plan.url)).toEqual([
      'https://park.example.com/b',
    ])
    expect(state.visibleUntaggedSavedPlanSuggestionSummaryText).toBe(
      '1 have suggestions: 1 commute. 1 still need manual tagging.',
    )
  })

  it('returns the all-suggested summary when every visible untagged plan has a suggestion', () => {
    const state = buildTripBoardSuggestionState({
      visibleSavedPlans: [
        createPlan({
          url: 'https://park.example.com/a',
          title: 'Commute option',
          addressLabel: 'Home garage',
        }),
      ],
      maxUntaggedSavedPlanQueue: 2,
      formatSavedPlanIntentSummary,
    })

    expect(state.visibleUntaggedSavedPlanSuggestionSummaryText).toBe(
      'All visible untagged plans have suggestions: 1 commute.',
    )
    expect(state.topSuggestedUntaggedSavedPlan?.url).toBe('https://park.example.com/a')
    expect(state.topManualUntaggedSavedPlan).toBeNull()
  })
})
