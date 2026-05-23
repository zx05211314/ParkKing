import type {
  UseSavedPlanConflictResolutionActionsOptions,
  UseSavedPlanConflictResolutionActionsResult,
} from './savedPlanConflictResolutionActionTypes'
import { useSavedPlanConflictApplySharedActions } from './useSavedPlanConflictApplySharedActions'
import { useSavedPlanConflictResolutionHistoryState } from './useSavedPlanConflictResolutionHistoryState'
import { useSavedPlanConflictUndoActions } from './useSavedPlanConflictUndoActions'

export type {
  UseSavedPlanConflictResolutionActionsOptions,
  UseSavedPlanConflictResolutionActionsResult,
} from './savedPlanConflictResolutionActionTypes'

export const useSavedPlanConflictResolutionActions = ({
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
}: UseSavedPlanConflictResolutionActionsOptions): UseSavedPlanConflictResolutionActionsResult => {
  const {
    savedPlanConflictResolutionHistory,
    savedPlanConflictResolutionHistoryCount,
    setSavedPlanConflictResolutionHistory,
    recordSavedPlanConflictResolution,
    resetSavedPlanConflictResolutionHistory,
  } = useSavedPlanConflictResolutionHistoryState({
    savedPlans,
    savedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    savedPlanConflictUrls,
  })

  const {
    handleResolveSavedPlanConflictWithShared,
    handleResolveVisibleSavedPlanConflictsWithShared,
  } = useSavedPlanConflictApplySharedActions({
    savedPlanConflictSharedByUrl,
    visibleSavedPlanUrls,
    savedPlanLimit,
    setSavedPlans,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
    recordSavedPlanConflictResolution,
  })

  const { handleUndoSavedPlanConflictResolution } = useSavedPlanConflictUndoActions({
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
  })

  return {
    savedPlanConflictResolutionHistoryCount,
    resetSavedPlanConflictResolutionHistory,
    handleResolveSavedPlanConflictWithShared,
    handleResolveVisibleSavedPlanConflictsWithShared,
    handleUndoSavedPlanConflictResolution,
  }
}
