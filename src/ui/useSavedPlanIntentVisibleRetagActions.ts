import { useCallback } from 'react'
import type {
  SavedPlanIntentFilterControlOptions,
  SavedPlanIntentMutationOptions,
} from './savedPlanIntentActionTypes'
import { setSavedPlanIntentForUrlsValue } from './savedPlanMutations'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'

interface UseSavedPlanIntentVisibleRetagActionsOptions
  extends SavedPlanIntentMutationOptions,
    SavedPlanIntentFilterControlOptions {
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
}

export interface UseSavedPlanIntentVisibleRetagActionsResult {
  handleSetVisibleSavedPlanIntent: (intent: SavedPlanIntent | null) => void
}

export const useSavedPlanIntentVisibleRetagActions = ({
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
}: UseSavedPlanIntentVisibleRetagActionsOptions): UseSavedPlanIntentVisibleRetagActionsResult => {
  const handleSetVisibleSavedPlanIntent = useCallback(
    (intent: SavedPlanIntent | null) => {
      if (visibleSavedPlanUrls.length === 0) {
        setShareStatus({ kind: 'error', message: 'No visible saved plans to retag.' })
        return
      }

      const changedCount = visibleSavedPlans.filter(
        (plan) => (plan.intent ?? null) !== intent,
      ).length
      if (changedCount === 0) {
        setShareStatus({
          kind: 'success',
          message:
            intent === null
              ? 'Visible saved plans already have no intent.'
              : `Visible saved plans already tagged as ${savedPlanIntentLabels[intent]}.`,
        })
        return
      }

      setSavedPlans((current) =>
        setSavedPlanIntentForUrlsValue(
          current,
          visibleSavedPlanUrls,
          intent,
          savedPlanLimit,
        ),
      )
      clearSavedPlanConflictsForUrls(visibleSavedPlanUrls)

      if (intent === null) {
        if (tripBoardIntentFilter !== 'ALL') {
          setTripBoardIntentFilter('ALL')
        }
        if (tripBoardSuggestionFilter !== 'ALL') {
          setTripBoardSuggestionFilter('ALL')
        }
        setShareStatus({
          kind: 'success',
          message: `Cleared intent for ${changedCount} visible saved plan${changedCount === 1 ? '' : 's'}.`,
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
        message: `Tagged ${changedCount} visible saved plan${changedCount === 1 ? '' : 's'} as ${savedPlanIntentLabels[intent]}.`,
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
      visibleSavedPlans,
      visibleSavedPlanUrls,
    ],
  )

  return {
    handleSetVisibleSavedPlanIntent,
  }
}
