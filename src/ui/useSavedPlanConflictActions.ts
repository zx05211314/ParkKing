import type { Dispatch, SetStateAction } from 'react'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import { useSavedPlanConflictClearActions } from './useSavedPlanConflictClearActions'
import { useSavedPlanConflictResolutionActions } from './useSavedPlanConflictResolutionActions'
export type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanConflictActionsOptions {
  savedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  savedPlanLimit: number
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

export interface UseSavedPlanConflictActionsResult {
  savedPlanConflictResolutionHistoryCount: number
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  resetSavedPlanConflictResolutionHistory: () => void
  handleClearSavedPlanConflict: (url: string) => void
  handleKeepVisibleSavedPlanConflictsLocal: () => void
  handleResolveSavedPlanConflictWithShared: (url: string) => void
  handleResolveVisibleSavedPlanConflictsWithShared: () => void
  handleUndoSavedPlanConflictResolution: () => void
  handleClearAllSavedPlanConflicts: () => void
}

export const useSavedPlanConflictActions = ({
  savedPlans,
  visibleSavedPlanUrls,
  savedPlanLimit,
  savedPlanConflictDetailsByUrl,
  setSavedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  setSavedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
}: UseSavedPlanConflictActionsOptions): UseSavedPlanConflictActionsResult => {
  const {
    clearSavedPlanConflictsForUrls,
    handleClearSavedPlanConflict,
    handleKeepVisibleSavedPlanConflictsLocal,
    handleClearAllSavedPlanConflicts,
  } = useSavedPlanConflictClearActions({
    visibleSavedPlanUrls,
    savedPlanConflictUrls,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setShareStatus,
  })

  const {
    savedPlanConflictResolutionHistoryCount,
    resetSavedPlanConflictResolutionHistory,
    handleResolveSavedPlanConflictWithShared,
    handleResolveVisibleSavedPlanConflictsWithShared,
    handleUndoSavedPlanConflictResolution,
  } = useSavedPlanConflictResolutionActions({
    savedPlans,
    visibleSavedPlanUrls,
    savedPlanLimit,
    savedPlanConflictDetailsByUrl,
    setSavedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    setSavedPlanConflictSharedByUrl,
    savedPlanConflictUrls,
    setSavedPlanConflictUrls,
    setSavedPlans,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
  })

  return {
    savedPlanConflictResolutionHistoryCount,
    clearSavedPlanConflictsForUrls,
    resetSavedPlanConflictResolutionHistory,
    handleClearSavedPlanConflict,
    handleKeepVisibleSavedPlanConflictsLocal,
    handleResolveSavedPlanConflictWithShared,
    handleResolveVisibleSavedPlanConflictsWithShared,
    handleUndoSavedPlanConflictResolution,
    handleClearAllSavedPlanConflicts,
  }
}
