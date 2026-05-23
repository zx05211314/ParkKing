import type {
  FormatSavedPlanIntentSummary,
  SavedPlanIntentFilterControlOptions,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import {
  useSavedPlanIntentGroupRetagActions,
  type UseSavedPlanIntentGroupRetagActionsResult,
} from './useSavedPlanIntentGroupRetagActions'
import {
  useSavedPlanIntentGroupSuggestionActions,
  type UseSavedPlanIntentGroupSuggestionActionsResult,
} from './useSavedPlanIntentGroupSuggestionActions'

interface UseSavedPlanIntentGroupActionsOptions
  extends SavedPlanIntentMutationOptions,
    SavedPlanIntentFilterControlOptions {
  formatSavedPlanIntentSummary: FormatSavedPlanIntentSummary
}

interface UseSavedPlanIntentGroupActionsResult {
  handleApplySavedPlanGroupIntentSuggestions:
    UseSavedPlanIntentGroupSuggestionActionsResult['handleApplySavedPlanGroupIntentSuggestions']
  handleApplySavedPlanGroupIntentSuggestionsForIntent:
    UseSavedPlanIntentGroupSuggestionActionsResult['handleApplySavedPlanGroupIntentSuggestionsForIntent']
  handleSetSavedPlanGroupIntent:
    UseSavedPlanIntentGroupRetagActionsResult['handleSetSavedPlanGroupIntent']
}

export const useSavedPlanIntentGroupActions = ({
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
}: UseSavedPlanIntentGroupActionsOptions): UseSavedPlanIntentGroupActionsResult => {
  const { handleSetSavedPlanGroupIntent } = useSavedPlanIntentGroupRetagActions({
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
    handleApplySavedPlanGroupIntentSuggestions,
    handleApplySavedPlanGroupIntentSuggestionsForIntent,
  } = useSavedPlanIntentGroupSuggestionActions({
    savedPlanLimit,
    savedPlanIntentLabels,
    setSavedPlans,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
    formatSavedPlanIntentSummary,
  })

  return {
    handleApplySavedPlanGroupIntentSuggestions,
    handleApplySavedPlanGroupIntentSuggestionsForIntent,
    handleSetSavedPlanGroupIntent,
  }
}
