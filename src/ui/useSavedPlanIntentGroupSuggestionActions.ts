import { useCallback } from 'react'
import type {
  FormatSavedPlanIntentSummary,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import {
  filterSavedPlanIntentSuggestionAssignments,
  getSavedPlanIntentSuggestionAssignments,
  summarizeSavedPlanIntentSuggestions,
} from './savedPlanIntentSuggestions'
import { applySavedPlanIntentSuggestionAssignments } from './savedPlanIntentSuggestionMutation'
import {
  resolveSavedPlanIntentSuggestionApplyForIntentState,
  resolveSavedPlanIntentSuggestionApplyState,
} from './savedPlanIntentSuggestionActionState'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'

interface UseSavedPlanIntentGroupSuggestionActionsOptions
  extends SavedPlanIntentMutationOptions {
  formatSavedPlanIntentSummary: FormatSavedPlanIntentSummary
}

export interface UseSavedPlanIntentGroupSuggestionActionsResult {
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

export const useSavedPlanIntentGroupSuggestionActions = ({
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  formatSavedPlanIntentSummary,
}: UseSavedPlanIntentGroupSuggestionActionsOptions): UseSavedPlanIntentGroupSuggestionActionsResult => {
  const handleApplySavedPlanGroupIntentSuggestions = useCallback(
    (plans: SavedPlan[], groupLabel: string) => {
      const untaggedPlans = plans.filter((plan) => !plan.intent)
      const assignments = getSavedPlanIntentSuggestionAssignments(untaggedPlans)
      const suggestionSummary = summarizeSavedPlanIntentSuggestions(assignments)
      const result = resolveSavedPlanIntentSuggestionApplyState({
        untaggedPlansCount: untaggedPlans.length,
        assignments,
        suggestionSummary,
        singularTargetLabel: `${groupLabel} saved plan`,
        pluralTargetLabel: `${groupLabel} untagged saved plans`,
        formatSavedPlanIntentSummary,
      })
      if (result.kind === 'status') {
        setShareStatus(result.status)
        return
      }

      applySavedPlanIntentSuggestionAssignments({
        assignmentUrls: result.assignmentUrls,
        savedPlanLimit,
        setSavedPlans,
        clearSavedPlanConflictsForUrls,
      })
      setShareStatus(result.status)
    },
    [
      clearSavedPlanConflictsForUrls,
      formatSavedPlanIntentSummary,
      savedPlanLimit,
      setSavedPlans,
      setShareStatus,
    ],
  )

  const handleApplySavedPlanGroupIntentSuggestionsForIntent = useCallback(
    (plans: SavedPlan[], groupLabel: string, intent: SavedPlanIntent) => {
      const untaggedPlans = plans.filter((plan) => !plan.intent)
      const assignments = getSavedPlanIntentSuggestionAssignments(untaggedPlans)
      const filteredAssignments = filterSavedPlanIntentSuggestionAssignments(assignments, intent)
      const result = resolveSavedPlanIntentSuggestionApplyForIntentState({
        untaggedPlansCount: untaggedPlans.length,
        filteredAssignments,
        totalSuggestedCount: assignments.length,
        singularTargetLabel: `${groupLabel} saved plan`,
        pluralTargetLabel: `${groupLabel} untagged saved plans`,
        intentLabel: savedPlanIntentLabels[intent],
      })
      if (result.kind === 'status') {
        setShareStatus(result.status)
        return
      }

      applySavedPlanIntentSuggestionAssignments({
        assignmentUrls: result.assignmentUrls,
        savedPlanLimit,
        setSavedPlans,
        clearSavedPlanConflictsForUrls,
      })
      setShareStatus(result.status)
    },
    [
      clearSavedPlanConflictsForUrls,
      savedPlanIntentLabels,
      savedPlanLimit,
      setSavedPlans,
      setShareStatus,
    ],
  )

  return {
    handleApplySavedPlanGroupIntentSuggestions,
    handleApplySavedPlanGroupIntentSuggestionsForIntent,
  }
}
