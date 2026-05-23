import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  appendSavedPlanConflictResolutionHistory,
  buildSavedPlanConflictResolutionHistory,
  MAX_SAVED_PLAN_CONFLICT_RESOLUTION_HISTORY,
} from './savedPlanConflictResolutionActionState'
import type { SavedPlanConflictResolutionHistoryEntry } from './savedPlanConflictResolutionHistory'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { RecordSavedPlanConflictResolution } from './savedPlanConflictResolutionActionTypes'

interface UseSavedPlanConflictResolutionHistoryStateOptions {
  savedPlans: SavedPlan[]
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
}

interface UseSavedPlanConflictResolutionHistoryStateResult {
  savedPlanConflictResolutionHistory: SavedPlanConflictResolutionHistoryEntry[]
  savedPlanConflictResolutionHistoryCount: number
  setSavedPlanConflictResolutionHistory: Dispatch<
    SetStateAction<SavedPlanConflictResolutionHistoryEntry[]>
  >
  recordSavedPlanConflictResolution: RecordSavedPlanConflictResolution
  resetSavedPlanConflictResolutionHistory: () => void
}

export const useSavedPlanConflictResolutionHistoryState = ({
  savedPlans,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
}: UseSavedPlanConflictResolutionHistoryStateOptions): UseSavedPlanConflictResolutionHistoryStateResult => {
  const [savedPlanConflictResolutionHistory, setSavedPlanConflictResolutionHistory] =
    useState<SavedPlanConflictResolutionHistoryEntry[]>([])

  const recordSavedPlanConflictResolution = useCallback(
    (urls: string[]) => {
      const nextEntry = buildSavedPlanConflictResolutionHistory({
        urls,
        savedPlans,
        savedPlanConflictDetailsByUrl,
        savedPlanConflictSharedByUrl,
        savedPlanConflictUrls,
      })
      setSavedPlanConflictResolutionHistory((currentHistory) =>
        appendSavedPlanConflictResolutionHistory(
          currentHistory,
          nextEntry,
          MAX_SAVED_PLAN_CONFLICT_RESOLUTION_HISTORY,
        ),
      )
    },
    [
      savedPlanConflictDetailsByUrl,
      savedPlanConflictSharedByUrl,
      savedPlanConflictUrls,
      savedPlans,
    ],
  )

  const resetSavedPlanConflictResolutionHistory = useCallback(() => {
    setSavedPlanConflictResolutionHistory([])
  }, [])

  return {
    savedPlanConflictResolutionHistory,
    savedPlanConflictResolutionHistoryCount: savedPlanConflictResolutionHistory.length,
    setSavedPlanConflictResolutionHistory,
    recordSavedPlanConflictResolution,
    resetSavedPlanConflictResolutionHistory,
  }
}
