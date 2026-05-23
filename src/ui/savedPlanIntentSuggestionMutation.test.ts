import { describe, expect, it, vi } from 'vitest'
import { applySavedPlanIntentSuggestionAssignments } from './savedPlanIntentSuggestionMutation'
import type { SavedPlan } from './savedPlanTypes'

describe('savedPlanIntentSuggestionMutation', () => {
  it('applies assignment urls and clears matching conflict badges', () => {
    const initialPlans: SavedPlan[] = [
      {
        key: 'a',
        url: 'a',
        title: 'Morning commute',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        pinned: false,
        createdAt: '2026-03-20T00:00:00.000Z',
      },
      {
        key: 'b',
        url: 'b',
        title: 'Plan B',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        pinned: false,
        createdAt: '2026-03-20T00:00:00.000Z',
      },
    ]
    let nextPlans = initialPlans
    const clearSavedPlanConflictsForUrls = vi.fn<(urls: string[]) => void>()

    applySavedPlanIntentSuggestionAssignments({
      assignmentUrls: ['a'],
      savedPlanLimit: 20,
      setSavedPlans: (updater) => {
        nextPlans =
          typeof updater === 'function'
            ? updater(nextPlans)
            : updater
      },
      clearSavedPlanConflictsForUrls,
    })

    expect(nextPlans[0]?.intent).toBe('COMMUTE')
    expect(nextPlans[1]?.intent).toBeUndefined()
    expect(clearSavedPlanConflictsForUrls).toHaveBeenCalledWith(['a'])
  })
})
