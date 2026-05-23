import { useCallback } from 'react'
import type {
  SavedPlanIntentFilterControlOptions,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import { setSavedPlanIntentForUrlsValue } from './savedPlanMutations'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'

interface UseSavedPlanIntentGroupRetagActionsOptions
  extends SavedPlanIntentMutationOptions,
    SavedPlanIntentFilterControlOptions {}

export interface UseSavedPlanIntentGroupRetagActionsResult {
  handleSetSavedPlanGroupIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent | null,
  ) => void
}

export const useSavedPlanIntentGroupRetagActions = ({
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanIntentGroupRetagActionsOptions): UseSavedPlanIntentGroupRetagActionsResult => {
  const handleSetSavedPlanGroupIntent = useCallback(
    (plans: SavedPlan[], groupLabel: string, intent: SavedPlanIntent | null) => {
      if (plans.length === 0) {
        setShareStatus({
          kind: 'error',
          message: 'No saved plans in that group to retag.',
        })
        return
      }

      const changedCount = plans.filter((plan) => (plan.intent ?? null) !== intent).length
      if (changedCount === 0) {
        setShareStatus({
          kind: 'success',
          message:
            intent === null
              ? `${groupLabel} already has no saved-plan intents to clear.`
              : `${groupLabel} already tagged as ${savedPlanIntentLabels[intent]}.`,
        })
        return
      }

      setSavedPlans((current) =>
        setSavedPlanIntentForUrlsValue(
          current,
          plans.map((plan) => plan.url),
          intent,
          savedPlanLimit,
        ),
      )
      clearSavedPlanConflictsForUrls(plans.map((plan) => plan.url))

      if (intent === null) {
        if (tripBoardIntentFilter !== 'ALL') {
          setTripBoardIntentFilter('ALL')
        }
        if (tripBoardSuggestionFilter !== 'ALL') {
          setTripBoardSuggestionFilter('ALL')
        }
        setShareStatus({
          kind: 'success',
          message: `Cleared intent for ${changedCount} ${groupLabel} saved plan${changedCount === 1 ? '' : 's'}.`,
        })
        return
      }

      if (tripBoardIntentFilter !== 'ALL' && tripBoardIntentFilter !== intent) {
        setTripBoardIntentFilter(intent)
      }
      if (tripBoardSuggestionFilter !== 'ALL') {
        setTripBoardSuggestionFilter('ALL')
      }
      setShareStatus({
        kind: 'success',
        message: `Tagged ${changedCount} ${groupLabel} saved plan${changedCount === 1 ? '' : 's'} as ${savedPlanIntentLabels[intent]}.`,
      })
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
      tripBoardSuggestionFilter,
    ],
  )

  return {
    handleSetSavedPlanGroupIntent,
  }
}
