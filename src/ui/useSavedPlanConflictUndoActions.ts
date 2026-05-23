import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { buildUndoSavedPlanConflictResolutionState } from './savedPlanConflictResolutionActionState'
import type { SavedPlanConflictResolutionHistoryEntry } from './savedPlanConflictResolutionHistory'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanConflictUndoActionsOptions {
  savedPlans: SavedPlan[]
  savedPlanLimit: number
  savedPlanConflictResolutionHistory: SavedPlanConflictResolutionHistoryEntry[]
  setSavedPlanConflictResolutionHistory: Dispatch<
    SetStateAction<SavedPlanConflictResolutionHistoryEntry[]>
  >
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  savedPlanConflictUrls: string[]
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

interface UseSavedPlanConflictUndoActionsResult {
  handleUndoSavedPlanConflictResolution: () => void
}

export const useSavedPlanConflictUndoActions = ({
  savedPlans,
  savedPlanLimit,
  savedPlanConflictResolutionHistory,
  setSavedPlanConflictResolutionHistory,
  savedPlanConflictDetailsByUrl,
  setSavedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  setSavedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
}: UseSavedPlanConflictUndoActionsOptions): UseSavedPlanConflictUndoActionsResult => {
  const handleUndoSavedPlanConflictResolution = useCallback(() => {
    const undoState = buildUndoSavedPlanConflictResolutionState({
      currentConflictDetailsByUrl: savedPlanConflictDetailsByUrl,
      currentConflictSharedByUrl: savedPlanConflictSharedByUrl,
      currentConflictUrls: savedPlanConflictUrls,
      currentPlans: savedPlans,
      history: savedPlanConflictResolutionHistory,
      savedPlanLimit,
    })
    if (undoState.kind === 'error') {
      setShareStatus({
        kind: 'error',
        message: undoState.message,
      })
      return
    }

    setSavedPlans(undoState.restoredState.plans)
    setSavedPlanConflictDetailsByUrl(undoState.restoredState.conflictDetailsByUrl)
    setSavedPlanConflictSharedByUrl(undoState.restoredState.conflictSharedByUrl)
    setSavedPlanConflictUrls(undoState.restoredState.conflictUrls)
    setSavedPlanConflictResolutionHistory((currentHistory) => currentHistory.slice(1))
    setShareStatus({
      kind: 'success',
      message: undoState.message,
    })
  }, [
    savedPlanConflictDetailsByUrl,
    savedPlanConflictResolutionHistory,
    savedPlanConflictSharedByUrl,
    savedPlanConflictUrls,
    savedPlanLimit,
    savedPlans,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictResolutionHistory,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setSavedPlans,
    setShareStatus,
  ])

  return {
    handleUndoSavedPlanConflictResolution,
  }
}
