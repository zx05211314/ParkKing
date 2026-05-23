import { describe, expect, it } from 'vitest'
import {
  resolveSavedPlanIntentSuggestionApplyForIntentState,
  resolveSavedPlanIntentSuggestionApplyState,
} from './savedPlanIntentSuggestionActionState'

const formatSavedPlanIntentSummary = (
  counts: { COMMUTE: number; PICKUP: number; BACKUP: number },
) => `Commute ${counts.COMMUTE} | Pickup ${counts.PICKUP} | Backup ${counts.BACKUP}`

describe('savedPlanIntentSuggestionActionState', () => {
  it('returns status-only results for empty or unsuggested inputs', () => {
    expect(
      resolveSavedPlanIntentSuggestionApplyState({
        untaggedPlansCount: 0,
        assignments: [],
        suggestionSummary: { totalCount: 0, COMMUTE: 0, PICKUP: 0, BACKUP: 0 },
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        formatSavedPlanIntentSummary,
      }),
    ).toEqual({
      kind: 'status',
      status: {
        kind: 'error',
        message: 'No visible untagged saved plans to auto-tag.',
      },
    })

    expect(
      resolveSavedPlanIntentSuggestionApplyForIntentState({
        untaggedPlansCount: 2,
        filteredAssignments: [],
        totalSuggestedCount: 1,
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        intentLabel: 'Backup',
      }),
    ).toEqual({
      kind: 'status',
      status: {
        kind: 'success',
        message: 'No visible untagged saved plans currently suggest Backup.',
      },
    })
  })

  it('returns apply payloads with urls and remaining counts', () => {
    expect(
      resolveSavedPlanIntentSuggestionApplyState({
        untaggedPlansCount: 3,
        assignments: [
          { url: 'a', intent: 'COMMUTE', reason: 'a' },
          { url: 'b', intent: 'BACKUP', reason: 'b' },
        ],
        suggestionSummary: { totalCount: 2, COMMUTE: 1, PICKUP: 0, BACKUP: 1 },
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        formatSavedPlanIntentSummary,
      }),
    ).toEqual({
      kind: 'apply',
      assignmentUrls: ['a', 'b'],
      remainingManualCount: 1,
      shouldReturnToAllIntents: false,
      status: {
        kind: 'success',
        message:
          'Applied suggestions to 2 visible untagged saved plans (Commute 1 | Pickup 0 | Backup 1). 1 still need manual tagging.',
      },
    })

    expect(
      resolveSavedPlanIntentSuggestionApplyForIntentState({
        untaggedPlansCount: 3,
        filteredAssignments: [{ url: 'b', intent: 'BACKUP', reason: 'b' }],
        totalSuggestedCount: 2,
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        intentLabel: 'Backup',
      }),
    ).toEqual({
      kind: 'apply',
      assignmentUrls: ['b'],
      remainingUntaggedCount: 2,
      remainingSuggestedCount: 1,
      remainingManualCount: 1,
      shouldReturnToAllIntents: false,
      status: {
        kind: 'success',
        message:
          'Applied Backup suggestions to 1 visible untagged saved plan. 2 remain (1 suggested, 1 manual).',
      },
    })
  })

  it('marks return-to-all results without rewriting the message in the hook', () => {
    expect(
      resolveSavedPlanIntentSuggestionApplyState({
        untaggedPlansCount: 1,
        assignments: [{ url: 'a', intent: 'COMMUTE', reason: 'a' }],
        suggestionSummary: { totalCount: 1, COMMUTE: 1, PICKUP: 0, BACKUP: 0 },
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        formatSavedPlanIntentSummary,
        returnToAllIntentsWhenNoRemainingManual: true,
      }),
    ).toEqual({
      kind: 'apply',
      assignmentUrls: ['a'],
      remainingManualCount: 0,
      shouldReturnToAllIntents: true,
      status: {
        kind: 'success',
        message:
          'Applied suggestions to 1 visible untagged saved plan (Commute 1 | Pickup 0 | Backup 0) and returned to all intents.',
      },
    })

    expect(
      resolveSavedPlanIntentSuggestionApplyForIntentState({
        untaggedPlansCount: 1,
        filteredAssignments: [{ url: 'b', intent: 'BACKUP', reason: 'b' }],
        totalSuggestedCount: 1,
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        intentLabel: 'Backup',
        returnToAllIntentsWhenNoRemainingUntagged: true,
      }),
    ).toEqual({
      kind: 'apply',
      assignmentUrls: ['b'],
      remainingUntaggedCount: 0,
      remainingSuggestedCount: 0,
      remainingManualCount: 0,
      shouldReturnToAllIntents: true,
      status: {
        kind: 'success',
        message:
          'Applied Backup suggestions to 1 visible untagged saved plan and returned to all intents.',
      },
    })
  })
})
