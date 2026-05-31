import { describe, expect, it } from 'vitest'
import {
  appendSavedPlanConflictResolutionHistory,
  applySavedPlanConflictResolution,
  buildSavedPlanConflictResolutionHistory,
  buildSavedPlanConflictResolutionState,
  buildUndoSavedPlanConflictResolutionState,
} from './savedPlanConflictResolutionActionState'
import type { SavedPlan } from './savedPlanTypes'

const buildPlan = (url: string, title: string): SavedPlan => ({
  key: url,
  title,
  url,
  datasetId: 'xinyi',
  addressLabel: null,
  segmentName: null,
  targetLabel: null,
  createdAt: '2026-03-18T00:00:00.000Z',
})

describe('savedPlanConflictResolutionActionState', () => {
  it('builds single and visible resolution messages from shared plans', () => {
    expect(
      buildSavedPlanConflictResolutionState({
        mode: 'single',
        savedPlanConflictSharedByUrl: {
          one: buildPlan('one', 'Remote one'),
        },
        urls: ['one'],
      }),
    ).toEqual({
      kind: 'success',
      value: {
        message: 'Applied the shared version for that saved plan.',
        resolvedUrls: ['one'],
        resolvedPlans: [buildPlan('one', 'Remote one')],
      },
    })

    expect(
      buildSavedPlanConflictResolutionState({
        mode: 'visible',
        savedPlanConflictSharedByUrl: {},
        urls: ['one'],
      }),
    ).toEqual({
      kind: 'error',
      message: 'No visible conflicted saved plans have a shared version to apply.',
    })
  })

  it('appends history entries and applies shared plans', () => {
    const historyEntry = buildSavedPlanConflictResolutionHistory({
      urls: ['one'],
      savedPlans: [buildPlan('one', 'Local one')],
      savedPlanConflictDetailsByUrl: {
        one: [{ label: 'Title', keptValue: 'Local one', sharedValue: 'Remote one' }],
      },
      savedPlanConflictSharedByUrl: {
        one: buildPlan('one', 'Remote one'),
      },
      savedPlanConflictUrls: ['one'],
    })

    expect(
      appendSavedPlanConflictResolutionHistory([], historyEntry, 5),
    ).toEqual([historyEntry])
    expect(
      applySavedPlanConflictResolution({
        currentPlans: [buildPlan('one', 'Local one')],
        resolvedPlans: [buildPlan('one', 'Remote one')],
        savedPlanLimit: 8,
      }),
    ).toEqual([{ ...buildPlan('one', 'Remote one'), pinned: false }])
  })

  it('builds undo state from the latest resolution history entry', () => {
    const historyEntry = buildSavedPlanConflictResolutionHistory({
      urls: ['one'],
      savedPlans: [buildPlan('one', 'Local one')],
      savedPlanConflictDetailsByUrl: {
        one: [{ label: 'Title', keptValue: 'Local one', sharedValue: 'Remote one' }],
      },
      savedPlanConflictSharedByUrl: {
        one: buildPlan('one', 'Remote one'),
      },
      savedPlanConflictUrls: ['one'],
    })

    expect(
      buildUndoSavedPlanConflictResolutionState({
        currentConflictDetailsByUrl: {},
        currentConflictSharedByUrl: {},
        currentConflictUrls: [],
        currentPlans: [buildPlan('one', 'Remote one')],
        history: historyEntry ? [historyEntry] : [],
        savedPlanLimit: 8,
      }),
    ).toEqual({
      kind: 'success',
      message: 'Reverted the last shared conflict resolution.',
      restoredState: {
        plans: [{ ...buildPlan('one', 'Local one'), pinned: false }],
        conflictDetailsByUrl: {
          one: [{ label: 'Title', keptValue: 'Local one', sharedValue: 'Remote one' }],
        },
        conflictSharedByUrl: {
          one: buildPlan('one', 'Remote one'),
        },
        conflictUrls: ['one'],
      },
    })
  })
})
