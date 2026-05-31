import type { Dispatch, SetStateAction } from 'react'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

export interface UseSavedPlanConflictResolutionActionsOptions {
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
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface UseSavedPlanConflictResolutionActionsResult {
  savedPlanConflictResolutionHistoryCount: number
  resetSavedPlanConflictResolutionHistory: () => void
  handleResolveSavedPlanConflictWithShared: (url: string) => void
  handleResolveVisibleSavedPlanConflictsWithShared: () => void
  handleUndoSavedPlanConflictResolution: () => void
}

export type RecordSavedPlanConflictResolution = (urls: string[]) => void
