import { describe, expect, it } from 'vitest'
import type { SavedPlan, SavedPlanGroup } from './savedPlanTypes'
import { buildTripBoardSavedPlanGroupSectionState } from './tripBoardSavedPlanGroupSectionState'

const createPlan = (overrides: Partial<SavedPlan>): SavedPlan => ({
  key: overrides.key ?? overrides.url ?? 'plan',
  title: overrides.title ?? 'Plan',
  url: overrides.url ?? 'https://park.example.test/plan',
  datasetId: overrides.datasetId ?? null,
  addressLabel: overrides.addressLabel ?? null,
  segmentName: overrides.segmentName ?? null,
  targetLabel: overrides.targetLabel ?? null,
  createdAt: overrides.createdAt ?? '2026-03-20T00:00:00.000Z',
  pinned: overrides.pinned ?? false,
  ...overrides,
})

describe('tripBoardSavedPlanGroupSectionState', () => {
  it('builds group label, leaders, and review counts', () => {
    const group: SavedPlanGroup = {
      key: 'daan',
      plans: [
        createPlan({
          key: 'a',
          url: 'https://park.example.test/a',
          datasetId: 'daan',
          intent: 'COMMUTE',
          allowedAction: 'PARK',
          parkingSpaceCount: 2,
          walkingDurationSeconds: 240,
          drivingDurationSeconds: 120,
          tier: 'GREEN',
        }),
        createPlan({
          key: 'b',
          url: 'https://park.example.test/b',
          title: 'Backup fallback option',
          datasetId: 'daan',
        }),
      ],
      count: 2,
      pinnedCount: 0,
    }

    const result = buildTripBoardSavedPlanGroupSectionState({
      group,
      datasetLabelById: new Map([['daan', 'Daan District']]),
      collapsedSavedPlanGroups: ['daan'],
    })

    expect(result.groupLabel).toBe('Daan District')
    expect(result.groupSummary.totalCount).toBe(2)
    expect(result.groupIntentSummary.COMMUTE).toBe(1)
    expect(result.groupSuggestionSummary.totalCount).toBe(1)
    expect(result.groupManualReviewCount).toBe(0)
    expect(result.groupMetricLeaders).toHaveLength(3)
    expect(result.groupLeaderCandidates).toHaveLength(2)
    expect(result.topGroupPlan?.url).toBe('https://park.example.test/a')
    expect(result.groupCollapsed).toBe(true)
  })
})
