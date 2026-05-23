import {
  getSavedPlanIntentSuggestionAssignments,
  summarizeSavedPlanIntentSuggestions,
} from './savedPlanIntentSuggestions'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentSuggestion,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'

interface BuildTripBoardSuggestionStateOptions {
  visibleSavedPlans: SavedPlan[]
  maxUntaggedSavedPlanQueue: number
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
}

export interface TripBoardSuggestionState {
  visibleUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestions: SavedPlanIntentSuggestionAssignment[]
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  visibleUntaggedSavedPlanSuggestionByUrl: Map<string, SavedPlanIntentSuggestion>
  visibleSuggestedUntaggedSavedPlans: SavedPlan[]
  visibleManualUntaggedSavedPlans: SavedPlan[]
  visibleSuggestedUntaggedSavedPlanQueue: SavedPlan[]
  topSuggestedUntaggedSavedPlan: SavedPlan | null
  visibleManualUntaggedSavedPlanQueue: SavedPlan[]
  topManualUntaggedSavedPlan: SavedPlan | null
  visibleUntaggedSavedPlanSuggestionSummaryText: string | null
}

export const buildTripBoardSuggestionState = ({
  visibleSavedPlans,
  maxUntaggedSavedPlanQueue,
  formatSavedPlanIntentSummary,
}: BuildTripBoardSuggestionStateOptions): TripBoardSuggestionState => {
  const visibleUntaggedSavedPlans = visibleSavedPlans.filter((plan) => !plan.intent)
  const visibleUntaggedSavedPlanSuggestions = getSavedPlanIntentSuggestionAssignments(
    visibleUntaggedSavedPlans,
  )
  const visibleUntaggedSavedPlanSuggestionSummary = summarizeSavedPlanIntentSuggestions(
    visibleUntaggedSavedPlanSuggestions,
  )
  const visibleUntaggedSavedPlanSuggestionByUrl = new Map(
    visibleUntaggedSavedPlanSuggestions.map((assignment) => [
      assignment.url,
      {
        intent: assignment.intent,
        reason: assignment.reason,
      },
    ]),
  )
  const visibleSuggestedUntaggedSavedPlans = visibleUntaggedSavedPlans.filter((plan) =>
    visibleUntaggedSavedPlanSuggestionByUrl.has(plan.url),
  )
  const visibleManualUntaggedSavedPlans = visibleUntaggedSavedPlans.filter(
    (plan) => !visibleUntaggedSavedPlanSuggestionByUrl.has(plan.url),
  )
  const visibleSuggestedUntaggedSavedPlanQueue = visibleSuggestedUntaggedSavedPlans.slice(
    0,
    maxUntaggedSavedPlanQueue,
  )
  const topSuggestedUntaggedSavedPlan =
    visibleSuggestedUntaggedSavedPlans[0] ?? null
  const visibleManualUntaggedSavedPlanQueue = visibleManualUntaggedSavedPlans.slice(
    0,
    maxUntaggedSavedPlanQueue,
  )
  const topManualUntaggedSavedPlan = visibleManualUntaggedSavedPlans[0] ?? null

  let visibleUntaggedSavedPlanSuggestionSummaryText: string | null = null
  if (visibleUntaggedSavedPlans.length > 0) {
    if (visibleUntaggedSavedPlanSuggestionSummary.totalCount === 0) {
      visibleUntaggedSavedPlanSuggestionSummaryText =
        'No strong intent suggestions yet. Tag these plans manually.'
    } else {
      const summaryLabel = formatSavedPlanIntentSummary(
        visibleUntaggedSavedPlanSuggestionSummary,
        0,
      )
      const remainingManualCount =
        visibleUntaggedSavedPlans.length -
        visibleUntaggedSavedPlanSuggestionSummary.totalCount

      visibleUntaggedSavedPlanSuggestionSummaryText =
        remainingManualCount <= 0
          ? `All visible untagged plans have suggestions: ${summaryLabel}.`
          : `${visibleUntaggedSavedPlanSuggestionSummary.totalCount} have suggestions: ${summaryLabel}. ${remainingManualCount} still need manual tagging.`
    }
  }

  return {
    visibleUntaggedSavedPlans,
    visibleUntaggedSavedPlanSuggestions,
    visibleUntaggedSavedPlanSuggestionSummary,
    visibleUntaggedSavedPlanSuggestionByUrl,
    visibleSuggestedUntaggedSavedPlans,
    visibleManualUntaggedSavedPlans,
    visibleSuggestedUntaggedSavedPlanQueue,
    topSuggestedUntaggedSavedPlan,
    visibleManualUntaggedSavedPlanQueue,
    topManualUntaggedSavedPlan,
    visibleUntaggedSavedPlanSuggestionSummaryText,
  }
}
