import type {
  SavedPlan,
  SavedPlanComparisonHighlight,
  SavedPlanComparisonRow,
  SavedPlanGroup,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentGroup,
  SavedPlanIntentSuggestion,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionFilter,
  SavedPlanIntentSuggestionFilterSummary,
  SavedPlanIntentSuggestionSummary,
  SavedPlanIntentSummary,
  SavedPlanMetricLeader,
  TripBoardFilters,
  TripBoardSortMode,
} from './savedPlanTypes'
import { buildTripBoardComparisonState } from './tripBoardComparisonState'
import { buildTripBoardGroupState } from './tripBoardGroupState'
import { buildTripBoardSuggestionState } from './tripBoardSuggestionState'
import { buildTripBoardVisibleState } from './tripBoardVisibleState'

export interface BuildTripBoardStateOptions {
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

export interface TripBoardState {
  currentSavedPlan: SavedPlan | null
  orderedSavedPlans: SavedPlan[]
  tripBoardSuggestionFilterSummary: SavedPlanIntentSuggestionFilterSummary
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  visibleSavedPlanIntentSummary: SavedPlanIntentSummary
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSavedPlanIntentGroups: SavedPlanIntentGroup[]
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
  visibleSavedPlanIntentLeaders: SavedPlan[]
  topVisibleSavedPlan: SavedPlan | null
  compareBoardSelection: string[]
  topPinCandidate: SavedPlan | null
  visibleSavedPlanGroups: SavedPlanGroup[]
  visibleSavedPlanGroupKeys: string[]
  hasCollapsedVisibleSavedPlanGroups: boolean
  hasExpandedVisibleSavedPlanGroups: boolean
  hiddenCollapsedSavedPlanCount: number
  tripBoardStatusSummary: string | null
  comparedSavedPlans: SavedPlan[]
  savedPlanComparisonRows: SavedPlanComparisonRow[]
  savedPlanComparisonHighlights: SavedPlanComparisonHighlight[]
  comparedSavedPlanLeader: SavedPlan | null
  savedPlanMetricLeaders: SavedPlanMetricLeader[]
  savedPlanMetricLeaderBadges: Map<string, string[]>
  hasActiveTripBoardFilters: boolean
  compareBoardActionLabel: string
}

export const buildTripBoardState = ({
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
}: BuildTripBoardStateOptions): TripBoardState => {
  const visibleState = buildTripBoardVisibleState({
    currentShareUrl,
    savedPlans,
    savedPlanConflictUrls,
    tripBoardSortMode,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    tripBoardFilters,
    tripBoardQuery,
    comparedSavedPlanUrls,
  })

  const suggestionState = buildTripBoardSuggestionState({
    visibleSavedPlans: visibleState.visibleSavedPlans,
    maxUntaggedSavedPlanQueue,
    formatSavedPlanIntentSummary,
  })

  const groupState = buildTripBoardGroupState({
    orderedSavedPlans: visibleState.orderedSavedPlans,
    visibleSavedPlans: visibleState.visibleSavedPlans,
    savedPlansCount: savedPlans.length,
    collapsedSavedPlanGroups,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    tripBoardIntentFilterLabels,
    tripBoardSuggestionFilterLabels,
    visibleSavedPlanIntentSummary: visibleState.visibleSavedPlanIntentSummary,
    formatSavedPlanIntentSummary,
  })

  const comparisonState = buildTripBoardComparisonState({
    savedPlans,
    comparedSavedPlanUrls,
    visibleSavedPlans: visibleState.visibleSavedPlans,
    tripBoardSortMode,
    formatSavedPlanComparisonValue,
  })

  return {
    ...visibleState,
    ...suggestionState,
    ...groupState,
    ...comparisonState,
  }
}
