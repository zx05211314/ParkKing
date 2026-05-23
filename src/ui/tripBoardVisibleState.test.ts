import { describe, expect, it } from 'vitest'
import { buildTripBoardVisibleState } from './tripBoardVisibleState'
import type { SavedPlan } from './savedPlanTypes'

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

describe('tripBoardVisibleState', () => {
  it('builds ordered, visible, conflicted, and compare-ready state', () => {
    const savedPlans = [
      createPlan({
        url: 'https://park.example.com/a',
        title: 'Plan A',
        createdAt: '2026-03-18T00:01:00.000Z',
        intent: 'COMMUTE',
        addressLabel: 'Home garage',
        allowedAction: 'PARK',
      }),
      createPlan({
        url: 'https://park.example.com/b',
        title: 'Plan B',
        createdAt: '2026-03-18T00:02:00.000Z',
        addressLabel: 'Neutral block',
      }),
      createPlan({
        url: 'https://park.example.com/c',
        title: 'Plan C',
        createdAt: '2026-03-18T00:03:00.000Z',
        pinned: true,
        addressLabel: 'Pinned block',
      }),
    ]

    const state = buildTripBoardVisibleState({
      currentShareUrl: 'https://park.example.com/b',
      savedPlans,
      savedPlanConflictUrls: ['https://park.example.com/b'],
      tripBoardSortMode: 'RECENT',
      tripBoardIntentFilter: 'ALL',
      tripBoardSuggestionFilter: 'ALL',
      tripBoardFilters: {
        pinnedOnly: false,
        parkOnly: false,
        markedSpacesOnly: false,
        etaReadyOnly: false,
        conflictedOnly: false,
      },
      tripBoardQuery: 'block',
      comparedSavedPlanUrls: [
        'https://park.example.com/b',
        'https://park.example.com/c',
      ],
    })

    expect(state.currentSavedPlan?.url).toBe('https://park.example.com/b')
    expect(state.orderedSavedPlans.map((plan) => plan.url)).toEqual([
      'https://park.example.com/c',
      'https://park.example.com/b',
      'https://park.example.com/a',
    ])
    expect(state.visibleSavedPlans.map((plan) => plan.url)).toEqual([
      'https://park.example.com/c',
      'https://park.example.com/b',
    ])
    expect(state.visibleSavedPlanUrls).toEqual([
      'https://park.example.com/c',
      'https://park.example.com/b',
    ])
    expect(state.visibleConflictedSavedPlans.map((plan) => plan.url)).toEqual([
      'https://park.example.com/b',
    ])
    expect(state.compareBoardSelection).toEqual([
      'https://park.example.com/b',
      'https://park.example.com/c',
    ])
    expect(state.topPinCandidate?.url).toBe('https://park.example.com/b')
    expect(state.hasActiveTripBoardFilters).toBe(false)
  })

  it('marks active filters when intent or toggle filters are enabled', () => {
    const state = buildTripBoardVisibleState({
      currentShareUrl: null,
      savedPlans: [createPlan({ url: 'https://park.example.com/a', title: 'Plan A' })],
      savedPlanConflictUrls: [],
      tripBoardSortMode: 'QUALITY',
      tripBoardIntentFilter: 'UNTAGGED',
      tripBoardSuggestionFilter: 'SUGGESTED',
      tripBoardFilters: {
        pinnedOnly: true,
        parkOnly: false,
        markedSpacesOnly: false,
        etaReadyOnly: false,
        conflictedOnly: false,
      },
      tripBoardQuery: '',
      comparedSavedPlanUrls: [],
    })

    expect(state.hasActiveTripBoardFilters).toBe(true)
    expect(state.tripBoardSuggestionFilterSummary.SUGGESTED).toBe(0)
  })
})
