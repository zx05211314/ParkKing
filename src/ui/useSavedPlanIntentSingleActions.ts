import { useCallback } from 'react'
import type { SavedPlanIntentMutationOptions } from './savedPlanIntentActionTypes'
import { updateSavedPlanValue } from './savedPlanMutations'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'

type UseSavedPlanIntentSingleActionsOptions = SavedPlanIntentMutationOptions

interface UseSavedPlanIntentSingleActionsResult {
  handleSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
}

export const useSavedPlanIntentSingleActions = ({
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanIntentSingleActionsOptions): UseSavedPlanIntentSingleActionsResult => {
  const handleSetSavedPlanIntent = useCallback(
    (plan: SavedPlan, intent: SavedPlanIntent) => {
      const nextIntent = plan.intent === intent ? null : intent
      setSavedPlans((current) =>
        updateSavedPlanValue(current, plan.url, { intent: nextIntent }, savedPlanLimit),
      )
      clearSavedPlanConflictsForUrls([plan.url])
      setShareStatus({
        kind: 'success',
        message:
          nextIntent === null
            ? 'Saved plan intent cleared.'
            : `Saved plan tagged as ${savedPlanIntentLabels[nextIntent]}.`,
      })
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
    handleSetSavedPlanIntent,
  }
}
