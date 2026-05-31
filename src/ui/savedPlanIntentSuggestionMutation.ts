import type { Dispatch, SetStateAction } from 'react'
import { applySavedPlanIntentSuggestionsValue } from './savedPlanMutations'
import type { SavedPlan } from './savedPlanTypes'

interface ApplySavedPlanIntentSuggestionAssignmentsOptions {
  assignmentUrls: string[]
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export const applySavedPlanIntentSuggestionAssignments = ({
  assignmentUrls,
  savedPlanLimit,
  setSavedPlans,
  clearSavedPlanConflictsForUrls,
}: ApplySavedPlanIntentSuggestionAssignmentsOptions) => {
  setSavedPlans((current) =>
    applySavedPlanIntentSuggestionsValue(current, assignmentUrls, savedPlanLimit),
  )
  clearSavedPlanConflictsForUrls(assignmentUrls)
}
