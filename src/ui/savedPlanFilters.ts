import { getSavedPlanIntentSuggestion } from './savedPlanIntentSuggestions'
import {
  SAVED_PLAN_INTENT_LABELS,
  type SavedPlan,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionFilter,
  type TripBoardFilters,
} from './savedPlanTypes'

const normalizeQuery = (value: string) => value.trim().toLowerCase()

export const filterSavedPlansValue = (
  plans: SavedPlan[],
  query: string,
  filters: TripBoardFilters,
  intentFilter: SavedPlanIntentFilter,
  suggestionFilter: SavedPlanIntentSuggestionFilter,
  conflictedUrls: string[],
) => {
  const normalizedQuery = normalizeQuery(query)
  const conflictedUrlSet = new Set(conflictedUrls)

  return plans.filter((plan) => {
    if (intentFilter === 'UNTAGGED' && plan.intent) {
      return false
    }
    if (
      intentFilter !== 'ALL' &&
      intentFilter !== 'UNTAGGED' &&
      plan.intent !== intentFilter
    ) {
      return false
    }
    if (intentFilter === 'UNTAGGED' && suggestionFilter !== 'ALL') {
      const suggestion = getSavedPlanIntentSuggestion(plan)
      if (suggestionFilter === 'SUGGESTED' && !suggestion) {
        return false
      }
      if (suggestionFilter === 'MANUAL' && suggestion) {
        return false
      }
    }
    if (filters.pinnedOnly && !plan.pinned) {
      return false
    }
    if (filters.parkOnly && plan.allowedAction !== 'PARK') {
      return false
    }
    if (filters.markedSpacesOnly && (plan.parkingSpaceCount ?? 0) <= 0) {
      return false
    }
    if (
      filters.etaReadyOnly &&
      typeof plan.walkingDurationSeconds !== 'number' &&
      typeof plan.drivingDurationSeconds !== 'number'
    ) {
      return false
    }
    if (filters.conflictedOnly && !conflictedUrlSet.has(plan.url)) {
      return false
    }
    if (normalizedQuery.length === 0) {
      return true
    }

    return [
      plan.title,
      plan.datasetId,
      plan.addressLabel,
      plan.segmentName,
      plan.targetLabel,
      plan.allowedAction,
      plan.tier,
      plan.intent,
      plan.intent ? SAVED_PLAN_INTENT_LABELS[plan.intent] : null,
      typeof plan.parkingSpaceCount === 'number' ? String(plan.parkingSpaceCount) : null,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery))
  })
}
