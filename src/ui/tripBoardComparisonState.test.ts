import { describe, expect, it } from 'vitest'
import { buildTripBoardComparisonState } from './tripBoardComparisonState'
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

describe('tripBoardComparisonState', () => {
  it('builds comparison rows, highlights, leader, and badges', () => {
    const savedPlans = [
      createPlan({
        url: 'https://park.example.com/a',
        title: 'Plan A',
        datasetId: 'xinyi',
        walkingDurationSeconds: 120,
        drivingDurationSeconds: 90,
        allowedAction: 'PARK',
        parkingSpaceCount: 4,
        tier: 'YELLOW',
      }),
      createPlan({
        url: 'https://park.example.com/b',
        title: 'Plan B',
        datasetId: 'daan',
        walkingDurationSeconds: 180,
        allowedAction: 'TEMP_STOP',
        parkingSpaceCount: 1,
        tier: 'RED',
      }),
    ]

    const state = buildTripBoardComparisonState({
      savedPlans,
      comparedSavedPlanUrls: [
        'https://park.example.com/a',
        'https://park.example.com/b',
      ],
      visibleSavedPlans: savedPlans,
      tripBoardSortMode: 'WALK_ETA',
      formatSavedPlanComparisonValue: (label, value) => `${label}: ${value}`,
    })

    expect(state.comparedSavedPlans).toHaveLength(2)
    expect(state.savedPlanComparisonRows[0]).toEqual(
      expect.objectContaining({
        label: 'District',
        left: 'District: xinyi',
        right: 'District: daan',
      }),
    )
    expect(state.savedPlanComparisonHighlights).toHaveLength(3)
    expect(state.comparedSavedPlanLeader?.url).toBe('https://park.example.com/a')
    expect(state.savedPlanMetricLeaders).toHaveLength(3)
    expect(state.savedPlanMetricLeaderBadges.get('https://park.example.com/a')).toContain(
      'Best walk',
    )
    expect(state.compareBoardActionLabel).toBe('Compare visible')
  })

  it('falls back to fill-compare label with a single compared plan', () => {
    const savedPlans = [
      createPlan({
        url: 'https://park.example.com/a',
        title: 'Plan A',
      }),
    ]

    const state = buildTripBoardComparisonState({
      savedPlans,
      comparedSavedPlanUrls: ['https://park.example.com/a'],
      visibleSavedPlans: savedPlans,
      tripBoardSortMode: 'QUALITY',
      formatSavedPlanComparisonValue: (_label, value) => value,
    })

    expect(state.savedPlanComparisonRows).toEqual([])
    expect(state.savedPlanComparisonHighlights).toEqual([])
    expect(state.comparedSavedPlanLeader).toBeNull()
    expect(state.compareBoardActionLabel).toBe('Fill compare')
  })
})
