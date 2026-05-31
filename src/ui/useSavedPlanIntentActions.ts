import type {
  FormatSavedPlanIntentSummary,
  SavedPlanIntentFilterControlOptions,
  SavedPlanIntentLabels,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'
import {
  buildSavedPlanIntentGroupActionOptions,
  buildSavedPlanIntentSingleActionOptions,
  buildSavedPlanIntentVisibleActionOptions,
} from './savedPlanIntentActionOptions'
import { useSavedPlanIntentGroupActions } from './useSavedPlanIntentGroupActions'
import { useSavedPlanIntentSingleActions } from './useSavedPlanIntentSingleActions'
import { useSavedPlanIntentVisibleActions } from './useSavedPlanIntentVisibleActions'

export interface UseSavedPlanIntentActionsOptions
  extends SavedPlanIntentMutationOptions,
    SavedPlanIntentFilterControlOptions {
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  visibleUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestions: SavedPlanIntentSuggestionAssignment[]
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  savedPlanIntentLabels: SavedPlanIntentLabels
  formatSavedPlanIntentSummary: FormatSavedPlanIntentSummary
}

export interface UseSavedPlanIntentActionsResult {
  handleSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  handleSetVisibleSavedPlanIntent: (intent: SavedPlanIntent | null) => void
  handleApplyVisibleSavedPlanIntentSuggestions: () => void
  handleApplyVisibleSavedPlanIntentSuggestionsForIntent: (
    intent: SavedPlanIntent,
  ) => void
  handleSetSavedPlanGroupIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent | null,
  ) => void
  handleApplySavedPlanGroupIntentSuggestions: (
    plans: SavedPlan[],
    groupLabel: string,
  ) => void
  handleApplySavedPlanGroupIntentSuggestionsForIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent,
  ) => void
}

export const useSavedPlanIntentActions = (
  options: UseSavedPlanIntentActionsOptions,
): UseSavedPlanIntentActionsResult => {
  const singleActions = useSavedPlanIntentSingleActions(
    buildSavedPlanIntentSingleActionOptions(options),
  )
  const visibleActions = useSavedPlanIntentVisibleActions(
    buildSavedPlanIntentVisibleActionOptions(options),
  )
  const groupActions = useSavedPlanIntentGroupActions(
    buildSavedPlanIntentGroupActionOptions(options),
  )

  return {
    ...singleActions,
    ...visibleActions,
    ...groupActions,
  }
}
