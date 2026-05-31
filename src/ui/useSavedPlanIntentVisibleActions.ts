import type {
  FormatSavedPlanIntentSummary,
  SavedPlanIntentFilterControlOptions,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import type {
  SavedPlan,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'
import {
  useSavedPlanIntentVisibleRetagActions,
  type UseSavedPlanIntentVisibleRetagActionsResult,
} from './useSavedPlanIntentVisibleRetagActions'
import {
  useSavedPlanIntentVisibleSuggestionActions,
  type UseSavedPlanIntentVisibleSuggestionActionsResult,
} from './useSavedPlanIntentVisibleSuggestionActions'

interface UseSavedPlanIntentVisibleActionsOptions
  extends SavedPlanIntentMutationOptions,
    SavedPlanIntentFilterControlOptions {
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  visibleUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestions: SavedPlanIntentSuggestionAssignment[]
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  formatSavedPlanIntentSummary: FormatSavedPlanIntentSummary
}

interface UseSavedPlanIntentVisibleActionsResult {
  handleApplyVisibleSavedPlanIntentSuggestions:
    UseSavedPlanIntentVisibleSuggestionActionsResult['handleApplyVisibleSavedPlanIntentSuggestions']
  handleApplyVisibleSavedPlanIntentSuggestionsForIntent:
    UseSavedPlanIntentVisibleSuggestionActionsResult['handleApplyVisibleSavedPlanIntentSuggestionsForIntent']
  handleSetVisibleSavedPlanIntent:
    UseSavedPlanIntentVisibleRetagActionsResult['handleSetVisibleSavedPlanIntent']
}

export const useSavedPlanIntentVisibleActions = ({
  visibleSavedPlans,
  visibleSavedPlanUrls,
  visibleUntaggedSavedPlans,
  visibleUntaggedSavedPlanSuggestions,
  visibleUntaggedSavedPlanSuggestionSummary,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  formatSavedPlanIntentSummary,
}: UseSavedPlanIntentVisibleActionsOptions): UseSavedPlanIntentVisibleActionsResult => {
  const { handleSetVisibleSavedPlanIntent } = useSavedPlanIntentVisibleRetagActions({
    visibleSavedPlans,
    visibleSavedPlanUrls,
    tripBoardIntentFilter,
    tripBoardSuggestionFilter,
    savedPlanLimit,
    savedPlanIntentLabels,
    setSavedPlans,
    setTripBoardIntentFilter,
    setTripBoardSuggestionFilter,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
  })

  const {
    handleApplyVisibleSavedPlanIntentSuggestions,
    handleApplyVisibleSavedPlanIntentSuggestionsForIntent,
  } = useSavedPlanIntentVisibleSuggestionActions({
    visibleUntaggedSavedPlans,
    visibleUntaggedSavedPlanSuggestions,
    visibleUntaggedSavedPlanSuggestionSummary,
    tripBoardIntentFilter,
    savedPlanLimit,
    savedPlanIntentLabels,
    setSavedPlans,
    setTripBoardIntentFilter,
    setTripBoardSuggestionFilter,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
    formatSavedPlanIntentSummary,
  })

  return {
    handleApplyVisibleSavedPlanIntentSuggestions,
    handleApplyVisibleSavedPlanIntentSuggestionsForIntent,
    handleSetVisibleSavedPlanIntent,
  }
}
