import { useCallback } from 'react'
import { filterSavedPlanIntentSuggestionAssignments } from './savedPlanIntentSuggestions'
import type {
  FormatSavedPlanIntentSummary,
  SavedPlanIntentFilterControlOptions,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import { applySavedPlanIntentSuggestionAssignments } from './savedPlanIntentSuggestionMutation'
import {
  resolveSavedPlanIntentSuggestionApplyForIntentState,
  resolveSavedPlanIntentSuggestionApplyState,
} from './savedPlanIntentSuggestionActionState'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'

interface UseSavedPlanIntentVisibleSuggestionActionsOptions
  extends SavedPlanIntentMutationOptions,
    Pick<
      SavedPlanIntentFilterControlOptions,
      'setTripBoardIntentFilter' | 'setTripBoardSuggestionFilter'
    > {
  visibleUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestions: SavedPlanIntentSuggestionAssignment[]
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  tripBoardIntentFilter: SavedPlanIntentFilter
  formatSavedPlanIntentSummary: FormatSavedPlanIntentSummary
}

export interface UseSavedPlanIntentVisibleSuggestionActionsResult {
  handleApplyVisibleSavedPlanIntentSuggestions: () => void
  handleApplyVisibleSavedPlanIntentSuggestionsForIntent: (
    intent: SavedPlanIntent,
  ) => void
}

export const useSavedPlanIntentVisibleSuggestionActions = ({
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
}: UseSavedPlanIntentVisibleSuggestionActionsOptions): UseSavedPlanIntentVisibleSuggestionActionsResult => {
  const handleApplyVisibleSavedPlanIntentSuggestions = useCallback(() => {
    const result = resolveSavedPlanIntentSuggestionApplyState({
      untaggedPlansCount: visibleUntaggedSavedPlans.length,
      assignments: visibleUntaggedSavedPlanSuggestions,
      suggestionSummary: visibleUntaggedSavedPlanSuggestionSummary,
      singularTargetLabel: 'visible untagged saved plan',
      pluralTargetLabel: 'visible untagged saved plans',
      formatSavedPlanIntentSummary,
      returnToAllIntentsWhenNoRemainingManual:
        tripBoardIntentFilter === 'UNTAGGED',
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

    if (result.shouldReturnToAllIntents) {
      setTripBoardIntentFilter('ALL')
      setTripBoardSuggestionFilter('ALL')
      setShareStatus(result.status)
      return
    }

    setShareStatus(result.status)
  }, [
    clearSavedPlanConflictsForUrls,
    formatSavedPlanIntentSummary,
    savedPlanLimit,
    setSavedPlans,
    setShareStatus,
    setTripBoardIntentFilter,
    setTripBoardSuggestionFilter,
    tripBoardIntentFilter,
    visibleUntaggedSavedPlans.length,
    visibleUntaggedSavedPlanSuggestionSummary,
    visibleUntaggedSavedPlanSuggestions,
  ])

  const handleApplyVisibleSavedPlanIntentSuggestionsForIntent = useCallback(
    (intent: SavedPlanIntent) => {
      const filteredAssignments = filterSavedPlanIntentSuggestionAssignments(
        visibleUntaggedSavedPlanSuggestions,
        intent,
      )
      const result = resolveSavedPlanIntentSuggestionApplyForIntentState({
        untaggedPlansCount: visibleUntaggedSavedPlans.length,
        filteredAssignments,
        totalSuggestedCount: visibleUntaggedSavedPlanSuggestionSummary.totalCount,
        singularTargetLabel: 'visible untagged saved plan',
        pluralTargetLabel: 'visible untagged saved plans',
        intentLabel: savedPlanIntentLabels[intent],
        returnToAllIntentsWhenNoRemainingUntagged:
          tripBoardIntentFilter === 'UNTAGGED',
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

      if (result.shouldReturnToAllIntents) {
        setTripBoardIntentFilter('ALL')
        setTripBoardSuggestionFilter('ALL')
        setShareStatus(result.status)
        return
      }

      setShareStatus(result.status)
    },
    [
      clearSavedPlanConflictsForUrls,
      savedPlanIntentLabels,
      savedPlanLimit,
      setSavedPlans,
      setShareStatus,
      setTripBoardIntentFilter,
      setTripBoardSuggestionFilter,
      tripBoardIntentFilter,
      visibleUntaggedSavedPlans.length,
      visibleUntaggedSavedPlanSuggestionSummary.totalCount,
      visibleUntaggedSavedPlanSuggestions,
    ],
  )

  return {
    handleApplyVisibleSavedPlanIntentSuggestions,
    handleApplyVisibleSavedPlanIntentSuggestionsForIntent,
  }
}
