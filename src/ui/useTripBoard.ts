import { useMemo } from 'react'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
  TripBoardFilters,
  TripBoardSortMode,
} from './savedPlanTypes'
import {
  buildTripBoardState,
  type TripBoardState,
} from './tripBoardState'

interface UseTripBoardOptions {
  currentShareUrl: string | null
  savedPlans: SavedPlan[]
  savedPlanConflictUrls: string[]
  tripBoardSortMode: TripBoardSortMode
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardFilters: TripBoardFilters
  tripBoardQuery: string
  comparedSavedPlanUrls: string[]
  collapsedSavedPlanGroups: string[]
  tripBoardIntentFilterLabels: Record<SavedPlanIntentFilter, string>
  tripBoardSuggestionFilterLabels: Record<SavedPlanIntentSuggestionFilter, string>
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  formatSavedPlanComparisonValue: (label: string, value: string) => string
  maxUntaggedSavedPlanQueue: number
}

export type UseTripBoardResult = TripBoardState

export const useTripBoard = ({
  currentShareUrl,
  savedPlans,
  savedPlanConflictUrls,
  tripBoardSortMode,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  tripBoardFilters,
  tripBoardQuery,
  comparedSavedPlanUrls,
  collapsedSavedPlanGroups,
  tripBoardIntentFilterLabels,
  tripBoardSuggestionFilterLabels,
  formatSavedPlanIntentSummary,
  formatSavedPlanComparisonValue,
  maxUntaggedSavedPlanQueue,
}: UseTripBoardOptions): UseTripBoardResult => {
  return useMemo(
    () =>
      buildTripBoardState({
        currentShareUrl,
        savedPlans,
        savedPlanConflictUrls,
        tripBoardSortMode,
        tripBoardIntentFilter,
        tripBoardSuggestionFilter,
        tripBoardFilters,
        tripBoardQuery,
        comparedSavedPlanUrls,
        collapsedSavedPlanGroups,
        tripBoardIntentFilterLabels,
        tripBoardSuggestionFilterLabels,
        formatSavedPlanIntentSummary,
        formatSavedPlanComparisonValue,
        maxUntaggedSavedPlanQueue,
      }),
    [
      collapsedSavedPlanGroups,
      comparedSavedPlanUrls,
      currentShareUrl,
      formatSavedPlanComparisonValue,
      formatSavedPlanIntentSummary,
      maxUntaggedSavedPlanQueue,
      savedPlanConflictUrls,
      savedPlans,
      tripBoardFilters,
      tripBoardIntentFilter,
      tripBoardIntentFilterLabels,
      tripBoardQuery,
      tripBoardSortMode,
      tripBoardSuggestionFilter,
      tripBoardSuggestionFilterLabels,
    ],
  )
}
