import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentSuggestion,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionFilterSummary,
  SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'

const SAVED_PLAN_INTENT_KEYWORDS: Record<SavedPlanIntent, string[]> = {
  COMMUTE: ['commute', 'home', 'work', 'office', 'hq', 'headquarters'],
  PICKUP: [
    'pickup',
    'pick-up',
    'dropoff',
    'drop-off',
    'school',
    'station',
    'airport',
    'hotel',
    'meet',
  ],
  BACKUP: [
    'backup',
    'alternate',
    'alternative',
    'alt',
    'fallback',
    'overflow',
    'reserve',
    'secondary',
  ],
}

export const getSavedPlanIntentSuggestion = (
  plan: SavedPlan,
): SavedPlanIntentSuggestion | null => {
  if (plan.intent) {
    return null
  }

  const haystack = [
    plan.title,
    plan.addressLabel,
    plan.segmentName,
    plan.targetLabel,
    plan.datasetId,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase()

  for (const keyword of SAVED_PLAN_INTENT_KEYWORDS.BACKUP) {
    if (haystack.includes(keyword)) {
      return {
        intent: 'BACKUP',
        reason: `Matches backup keyword "${keyword}".`,
      }
    }
  }

  for (const keyword of SAVED_PLAN_INTENT_KEYWORDS.COMMUTE) {
    if (haystack.includes(keyword)) {
      return {
        intent: 'COMMUTE',
        reason: `Matches commute keyword "${keyword}".`,
      }
    }
  }

  for (const keyword of SAVED_PLAN_INTENT_KEYWORDS.PICKUP) {
    if (haystack.includes(keyword)) {
      return {
        intent: 'PICKUP',
        reason: `Matches pickup keyword "${keyword}".`,
      }
    }
  }

  if (plan.allowedAction === 'TEMP_STOP') {
    return {
      intent: 'PICKUP',
      reason: 'Stop-only legality fits a pickup/drop-off use.',
    }
  }

  return null
}

export const getSavedPlanIntentSuggestionAssignments = (
  plans: SavedPlan[],
): SavedPlanIntentSuggestionAssignment[] =>
  plans.flatMap((plan) => {
    const suggestion = getSavedPlanIntentSuggestion(plan)
    return suggestion
      ? [
          {
            url: plan.url,
            intent: suggestion.intent,
            reason: suggestion.reason,
          },
        ]
      : []
  })

export const summarizeSavedPlanIntentSuggestionFilters = (
  plans: SavedPlan[],
): SavedPlanIntentSuggestionFilterSummary => {
  const summary: SavedPlanIntentSuggestionFilterSummary = {
    ALL: 0,
    SUGGESTED: 0,
    MANUAL: 0,
  }

  plans.forEach((plan) => {
    if (plan.intent) {
      return
    }

    summary.ALL += 1

    if (getSavedPlanIntentSuggestion(plan)) {
      summary.SUGGESTED += 1
      return
    }

    summary.MANUAL += 1
  })

  return summary
}

export const summarizeSavedPlanIntentSuggestions = (
  assignments: SavedPlanIntentSuggestionAssignment[],
): SavedPlanIntentSuggestionSummary => {
  const summary: SavedPlanIntentSuggestionSummary = {
    totalCount: assignments.length,
    COMMUTE: 0,
    PICKUP: 0,
    BACKUP: 0,
  }

  assignments.forEach((assignment) => {
    summary[assignment.intent] += 1
  })

  return summary
}

export const filterSavedPlanIntentSuggestionAssignments = (
  assignments: SavedPlanIntentSuggestionAssignment[],
  intent: SavedPlanIntent,
) => assignments.filter((assignment) => assignment.intent === intent)
