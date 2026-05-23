import { groupSavedPlansByIntent, summarizeSavedPlanIntents } from './savedPlanGrouping'
import { sortSavedPlans } from './savedPlanSort'
import {
  getTopSavedPlan,
  hasTripBoardFilters,
  selectSavedPlansForCompare,
} from './savedPlanBoardState'
import { filterSavedPlansValue } from './savedPlanFilters'
import { summarizeSavedPlanIntentSuggestionFilters } from './savedPlanIntentSuggestions'
import type {
  SavedPlan,
  SavedPlanIntentFilter,
  SavedPlanIntentGroup,
  SavedPlanIntentSuggestionFilter,
  SavedPlanIntentSuggestionFilterSummary,
  SavedPlanIntentSummary,
  TripBoardFilters,
  TripBoardSortMode,
} from './savedPlanTypes'

interface BuildTripBoardVisibleStateOptions {
  currentShareUrl: string | null
  savedPlans: SavedPlan[]
  savedPlanConflictUrls: string[]
  tripBoardSortMode: TripBoardSortMode
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardFilters: TripBoardFilters
  tripBoardQuery: string
  comparedSavedPlanUrls: string[]
}

export interface TripBoardVisibleState {
  currentSavedPlan: SavedPlan | null
  orderedSavedPlans: SavedPlan[]
  tripBoardSuggestionFilterSummary: SavedPlanIntentSuggestionFilterSummary
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  visibleSavedPlanIntentSummary: SavedPlanIntentSummary
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSavedPlanIntentGroups: SavedPlanIntentGroup[]
  visibleSavedPlanIntentLeaders: SavedPlan[]
  topVisibleSavedPlan: SavedPlan | null
  compareBoardSelection: string[]
  topPinCandidate: SavedPlan | null
  hasActiveTripBoardFilters: boolean
}

export const buildTripBoardVisibleState = ({
  currentShareUrl,
  savedPlans,
  savedPlanConflictUrls,
  tripBoardSortMode,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  tripBoardFilters,
  tripBoardQuery,
  comparedSavedPlanUrls,
}: BuildTripBoardVisibleStateOptions): TripBoardVisibleState => {
  const currentSavedPlan = currentShareUrl
    ? savedPlans.find((plan) => plan.url === currentShareUrl) ?? null
    : null

  const orderedSavedPlans = sortSavedPlans(savedPlans, tripBoardSortMode)
  const tripBoardSuggestionFilterBaseIntent: SavedPlanIntentFilter =
    tripBoardIntentFilter === 'UNTAGGED' ? 'UNTAGGED' : 'ALL'
  const tripBoardSuggestionFilterBasePlans = filterSavedPlansValue(
    orderedSavedPlans,
    tripBoardQuery,
    tripBoardFilters,
    tripBoardSuggestionFilterBaseIntent,
    'ALL',
    [],
  )
  const tripBoardSuggestionFilterSummary = summarizeSavedPlanIntentSuggestionFilters(
    tripBoardSuggestionFilterBasePlans,
  )

  const visibleSavedPlans = filterSavedPlansValue(
    orderedSavedPlans,
    tripBoardQuery,
    tripBoardFilters,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    savedPlanConflictUrls,
  )
  const visibleSavedPlanUrls = visibleSavedPlans.map((plan) => plan.url)
  const visibleSavedPlanIntentSummary = summarizeSavedPlanIntents(visibleSavedPlans)
  const visibleConflictedSavedPlans = visibleSavedPlans.filter((plan) =>
    savedPlanConflictUrls.includes(plan.url),
  )
  const visibleSavedPlanIntentGroups = groupSavedPlansByIntent(visibleSavedPlans)
  const visibleSavedPlanIntentLeaders = visibleSavedPlanIntentGroups.map(
    (group) => group.leader,
  )
  const topVisibleSavedPlan = getTopSavedPlan(visibleSavedPlans)
  const compareBoardSelection = selectSavedPlansForCompare(
    visibleSavedPlans,
    comparedSavedPlanUrls,
  )
  const topPinCandidate =
    visibleSavedPlans.find((plan) => !plan.pinned) ?? visibleSavedPlans[0] ?? null
  const hasActiveTripBoardFilters =
    hasTripBoardFilters(tripBoardFilters) ||
    tripBoardIntentFilter !== 'ALL' ||
    tripBoardSuggestionFilter !== 'ALL'

  return {
    currentSavedPlan,
    orderedSavedPlans,
    tripBoardSuggestionFilterSummary,
    visibleSavedPlans,
    visibleSavedPlanUrls,
    visibleSavedPlanIntentSummary,
    visibleConflictedSavedPlans,
    visibleSavedPlanIntentGroups,
    visibleSavedPlanIntentLeaders,
    topVisibleSavedPlan,
    compareBoardSelection,
    topPinCandidate,
    hasActiveTripBoardFilters,
  }
}
