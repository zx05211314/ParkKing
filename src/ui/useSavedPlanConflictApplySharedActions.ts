import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  applySavedPlanConflictResolution,
  buildSavedPlanConflictResolutionState,
} from './savedPlanConflictResolutionActionState'
import type {
  RecordSavedPlanConflictResolution,
} from './savedPlanConflictResolutionActionTypes'
import type { SavedPlan } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanConflictApplySharedActionsOptions {
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  visibleSavedPlanUrls: string[]
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  recordSavedPlanConflictResolution: RecordSavedPlanConflictResolution
}

interface UseSavedPlanConflictApplySharedActionsResult {
  handleResolveSavedPlanConflictWithShared: (url: string) => void
  handleResolveVisibleSavedPlanConflictsWithShared: () => void
}

export const useSavedPlanConflictApplySharedActions = ({
  savedPlanConflictSharedByUrl,
  visibleSavedPlanUrls,
  savedPlanLimit,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  recordSavedPlanConflictResolution,
}: UseSavedPlanConflictApplySharedActionsOptions): UseSavedPlanConflictApplySharedActionsResult => {
  const handleResolveSavedPlanConflictWithShared = useCallback(
    (url: string) => {
      const resolutionState = buildSavedPlanConflictResolutionState({
        mode: 'single',
        savedPlanConflictSharedByUrl,
        urls: [url],
      })
      if (resolutionState.kind === 'error') {
        setShareStatus({
          kind: 'error',
          message: resolutionState.message,
        })
        return
      }

      setSavedPlans((current) =>
        applySavedPlanConflictResolution({
          currentPlans: current,
          resolvedPlans: resolutionState.value.resolvedPlans,
          savedPlanLimit,
        }),
      )
      recordSavedPlanConflictResolution(resolutionState.value.resolvedUrls)
      clearSavedPlanConflictsForUrls(resolutionState.value.resolvedUrls)
      setShareStatus({
        kind: 'success',
        message: resolutionState.value.message,
      })
    },
    [
      clearSavedPlanConflictsForUrls,
      recordSavedPlanConflictResolution,
      savedPlanConflictSharedByUrl,
      savedPlanLimit,
      setSavedPlans,
      setShareStatus,
    ],
  )

  const handleResolveVisibleSavedPlanConflictsWithShared = useCallback(() => {
    const resolutionState = buildSavedPlanConflictResolutionState({
      mode: 'visible',
      savedPlanConflictSharedByUrl,
      urls: visibleSavedPlanUrls,
    })
    if (resolutionState.kind === 'error') {
      setShareStatus({
        kind: 'error',
        message: resolutionState.message,
      })
      return
    }

    recordSavedPlanConflictResolution(resolutionState.value.resolvedUrls)
    setSavedPlans((current) =>
      applySavedPlanConflictResolution({
        currentPlans: current,
        resolvedPlans: resolutionState.value.resolvedPlans,
        savedPlanLimit,
      }),
    )
    clearSavedPlanConflictsForUrls(resolutionState.value.resolvedUrls)
    setShareStatus({
      kind: 'success',
      message: resolutionState.value.message,
    })
  }, [
    clearSavedPlanConflictsForUrls,
    recordSavedPlanConflictResolution,
    savedPlanConflictSharedByUrl,
    savedPlanLimit,
    setSavedPlans,
    setShareStatus,
    visibleSavedPlanUrls,
  ])

  return {
    handleResolveSavedPlanConflictWithShared,
    handleResolveVisibleSavedPlanConflictsWithShared,
  }
}
