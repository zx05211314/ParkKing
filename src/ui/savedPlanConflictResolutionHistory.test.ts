import { describe, expect, it } from 'vitest'
import {
  buildSavedPlanConflictResolutionHistoryEntry,
  restoreSavedPlanConflictResolution,
} from './savedPlanConflictResolutionHistory'
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

describe('savedPlanConflictResolutionHistory', () => {
  it('builds a resolution history entry from saved plans and conflict state', () => {
    expect(
      buildSavedPlanConflictResolutionHistoryEntry({
        urls: ['one', 'one'],
        savedPlans: [buildPlan('one', 'Local one'), buildPlan('two', 'Two')],
        savedPlanConflictDetailsByUrl: {
          one: [{ label: 'Title', keptValue: 'Local one', sharedValue: 'Remote one' }],
        },
        savedPlanConflictSharedByUrl: {
          one: buildPlan('one', 'Remote one'),
        },
        savedPlanConflictUrls: ['one'],
      }),
    ).toEqual({
      resolvedUrls: ['one'],
      previousPlansByUrl: { one: buildPlan('one', 'Local one') },
      previousConflictDetailsByUrl: {
        one: [{ label: 'Title', keptValue: 'Local one', sharedValue: 'Remote one' }],
      },
      previousConflictSharedByUrl: {
        one: buildPlan('one', 'Remote one'),
      },
      previousConflictUrls: ['one'],
    })
  })

  it('restores plans and conflict state from a history entry', () => {
    const entry = buildSavedPlanConflictResolutionHistoryEntry({
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

    expect(entry).not.toBeNull()
    expect(
      restoreSavedPlanConflictResolution({
        currentPlans: [buildPlan('one', 'Remote one')],
        currentConflictDetailsByUrl: {},
        currentConflictSharedByUrl: {},
        currentConflictUrls: [],
        entry: entry!,
        savedPlanLimit: 8,
      }),
    ).toEqual({
      plans: [{ ...buildPlan('one', 'Local one'), pinned: false }],
      conflictDetailsByUrl: {
        one: [{ label: 'Title', keptValue: 'Local one', sharedValue: 'Remote one' }],
      },
      conflictSharedByUrl: {
        one: buildPlan('one', 'Remote one'),
      },
      conflictUrls: ['one'],
    })
  })
})
