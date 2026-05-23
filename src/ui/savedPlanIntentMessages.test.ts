import { describe, expect, it } from 'vitest'
import {
  buildSavedPlanIntentSuggestionsAppliedForIntentMessage,
  buildSavedPlanIntentSuggestionsAppliedMessage,
} from './savedPlanIntentMessages'

describe('savedPlanIntentMessages', () => {
  it('builds the general applied-suggestions message', () => {
    expect(
      buildSavedPlanIntentSuggestionsAppliedMessage({
        appliedCount: 2,
        summaryLabel: '1 commute, 1 pickup',
        singularTargetLabel: 'visible untagged saved plan',
        remainingManualCount: 3,
      }),
    ).toBe(
      'Applied suggestions to 2 visible untagged saved plans (1 commute, 1 pickup). 3 still need manual tagging.',
    )
  })

  it('builds the return-to-all-intents general message', () => {
    expect(
      buildSavedPlanIntentSuggestionsAppliedMessage({
        appliedCount: 1,
        summaryLabel: '1 commute',
        singularTargetLabel: 'visible untagged saved plan',
        remainingManualCount: 0,
        returnToAllIntents: true,
      }),
    ).toBe(
      'Applied suggestions to 1 visible untagged saved plan (1 commute) and returned to all intents.',
    )
  })

  it('builds the intent-specific message with remaining parts', () => {
    expect(
      buildSavedPlanIntentSuggestionsAppliedForIntentMessage({
        appliedCount: 2,
        intentLabel: 'Commute',
        singularTargetLabel: 'xinyi saved plan',
        remainingUntaggedCount: 3,
        remainingSuggestedCount: 1,
        remainingManualCount: 2,
      }),
    ).toBe(
      'Applied Commute suggestions to 2 xinyi saved plans. 3 remain (1 suggested, 2 manual).',
    )
  })

  it('builds the return-to-all-intents intent-specific message', () => {
    expect(
      buildSavedPlanIntentSuggestionsAppliedForIntentMessage({
        appliedCount: 1,
        intentLabel: 'Pickup',
        singularTargetLabel: 'visible untagged saved plan',
        remainingUntaggedCount: 0,
        remainingSuggestedCount: 0,
        remainingManualCount: 0,
        returnToAllIntents: true,
      }),
    ).toBe(
      'Applied Pickup suggestions to 1 visible untagged saved plan and returned to all intents.',
    )
  })
})
