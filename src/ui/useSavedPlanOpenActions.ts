import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'
import { readSharedAppState, type SharedAppState } from './shareState'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanOpenActionsOptions {
  applySharedState: (state: SharedAppState) => void
  topVisibleSavedPlan: SavedPlan | null
  topSuggestedUntaggedSavedPlan: SavedPlan | null
  topManualUntaggedSavedPlan: SavedPlan | null
  comparedSavedPlanLeader: SavedPlan | null
  savedPlanIntentLabels: Record<SavedPlanIntent, string>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanOpenActionsResult {
  handleOpenSavedPlan: (url: string) => void
  handleOpenTopSavedPlan: () => void
  handleOpenTopSuggestedUntaggedSavedPlan: () => void
  handleOpenTopManualUntaggedSavedPlan: () => void
  handleOpenSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  handleOpenComparedSavedPlanLeader: () => void
  handleOpenSavedPlanGroupTop: (plans: SavedPlan[]) => void
}

export const useSavedPlanOpenActions = ({
  applySharedState,
  topVisibleSavedPlan,
  topSuggestedUntaggedSavedPlan,
  topManualUntaggedSavedPlan,
  comparedSavedPlanLeader,
  savedPlanIntentLabels,
  setShareStatus,
}: UseSavedPlanOpenActionsOptions): UseSavedPlanOpenActionsResult => {
  const handleOpenSavedPlan = useCallback(
    (url: string) => {
      if (typeof window === 'undefined') {
        return
      }

      try {
        const parsed = new URL(url, window.location.origin)
        if (
          parsed.origin !== window.location.origin ||
          parsed.pathname !== window.location.pathname
        ) {
          window.location.assign(url)
          return
        }

        window.history.pushState(
          window.history.state,
          '',
          `${parsed.pathname}${parsed.search}${parsed.hash}`,
        )
        applySharedState(readSharedAppState(parsed.search))
        setShareStatus({
          kind: 'success',
          message: 'Saved plan opened.',
        })
      } catch {
        window.location.assign(url)
      }
    },
    [applySharedState, setShareStatus],
  )

  const handleOpenTopSavedPlan = useCallback(() => {
    if (!topVisibleSavedPlan) {
      setShareStatus({
        kind: 'error',
        message: 'No visible saved plans to open.',
      })
      return
    }
    handleOpenSavedPlan(topVisibleSavedPlan.url)
  }, [handleOpenSavedPlan, setShareStatus, topVisibleSavedPlan])

  const handleOpenTopSuggestedUntaggedSavedPlan = useCallback(() => {
    if (!topSuggestedUntaggedSavedPlan) {
      setShareStatus({
        kind: 'error',
        message: 'No suggested untagged saved plans to open.',
      })
      return
    }
    handleOpenSavedPlan(topSuggestedUntaggedSavedPlan.url)
  }, [handleOpenSavedPlan, setShareStatus, topSuggestedUntaggedSavedPlan])

  const handleOpenTopManualUntaggedSavedPlan = useCallback(() => {
    if (!topManualUntaggedSavedPlan) {
      setShareStatus({
        kind: 'error',
        message: 'No manual-review saved plans to open.',
      })
      return
    }
    handleOpenSavedPlan(topManualUntaggedSavedPlan.url)
  }, [handleOpenSavedPlan, setShareStatus, topManualUntaggedSavedPlan])

  const handleOpenSavedPlanIntentTop = useCallback(
    (intent: SavedPlanIntent, plans: SavedPlan[]) => {
      const topPlan = plans[0]
      if (!topPlan) {
        setShareStatus({
          kind: 'error',
          message: `No ${savedPlanIntentLabels[intent].toLowerCase()} saved plans to open.`,
        })
        return
      }
      handleOpenSavedPlan(topPlan.url)
    },
    [handleOpenSavedPlan, savedPlanIntentLabels, setShareStatus],
  )

  const handleOpenComparedSavedPlanLeader = useCallback(() => {
    if (!comparedSavedPlanLeader) {
      setShareStatus({
        kind: 'error',
        message: 'No compare leader available.',
      })
      return
    }
    handleOpenSavedPlan(comparedSavedPlanLeader.url)
  }, [comparedSavedPlanLeader, handleOpenSavedPlan, setShareStatus])

  const handleOpenSavedPlanGroupTop = useCallback(
    (plans: SavedPlan[]) => {
      const topPlan = plans[0]
      if (!topPlan) {
        setShareStatus({
          kind: 'error',
          message: 'No saved plans in that group.',
        })
        return
      }
      handleOpenSavedPlan(topPlan.url)
    },
    [handleOpenSavedPlan, setShareStatus],
  )

  return {
    handleOpenSavedPlan,
    handleOpenTopSavedPlan,
    handleOpenTopSuggestedUntaggedSavedPlan,
    handleOpenTopManualUntaggedSavedPlan,
    handleOpenSavedPlanIntentTop,
    handleOpenComparedSavedPlanLeader,
    handleOpenSavedPlanGroupTop,
  }
}
