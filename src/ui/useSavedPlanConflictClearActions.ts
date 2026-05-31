import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { clearSavedPlanConflictRecordUrls, clearSavedPlanConflictUrlList } from './savedPlanConflictState'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanConflictClearActionsOptions {
  visibleSavedPlanUrls: string[]
  savedPlanConflictUrls: string[]
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanConflictClearActionsResult {
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  handleClearSavedPlanConflict: (url: string) => void
  handleKeepVisibleSavedPlanConflictsLocal: () => void
  handleClearAllSavedPlanConflicts: () => void
}

export const useSavedPlanConflictClearActions = ({
  visibleSavedPlanUrls,
  savedPlanConflictUrls,
  setSavedPlanConflictDetailsByUrl,
  setSavedPlanConflictSharedByUrl,
  setSavedPlanConflictUrls,
  setShareStatus,
}: UseSavedPlanConflictClearActionsOptions): UseSavedPlanConflictClearActionsResult => {
  const clearSavedPlanConflictsForUrls = useCallback(
    (urls: string[]) => {
      if (urls.length === 0) {
        return
      }

      setSavedPlanConflictDetailsByUrl((currentConflictDetailsByUrl) =>
        clearSavedPlanConflictRecordUrls(currentConflictDetailsByUrl, urls),
      )
      setSavedPlanConflictSharedByUrl((currentConflictSharedByUrl) =>
        clearSavedPlanConflictRecordUrls(currentConflictSharedByUrl, urls),
      )
      setSavedPlanConflictUrls((currentConflictUrls) =>
        clearSavedPlanConflictUrlList(currentConflictUrls, urls),
      )
    },
    [
      setSavedPlanConflictDetailsByUrl,
      setSavedPlanConflictSharedByUrl,
      setSavedPlanConflictUrls,
    ],
  )

  const handleClearSavedPlanConflict = useCallback(
    (url: string) => {
      clearSavedPlanConflictsForUrls([url])
      setShareStatus({
        kind: 'success',
        message: 'Kept the local version for that saved plan.',
      })
    },
    [clearSavedPlanConflictsForUrls, setShareStatus],
  )

  const handleKeepVisibleSavedPlanConflictsLocal = useCallback(() => {
    const conflictedVisibleUrls = visibleSavedPlanUrls.filter((url) =>
      savedPlanConflictUrls.includes(url),
    )

    if (conflictedVisibleUrls.length === 0) {
      setShareStatus({
        kind: 'error',
        message: 'No visible conflicted saved plans are available to keep locally.',
      })
      return
    }

    clearSavedPlanConflictsForUrls(conflictedVisibleUrls)
    setShareStatus({
      kind: 'success',
      message: `Kept local versions for ${conflictedVisibleUrls.length} visible conflicted saved plan${conflictedVisibleUrls.length === 1 ? '' : 's'}.`,
    })
  }, [
    clearSavedPlanConflictsForUrls,
    savedPlanConflictUrls,
    setShareStatus,
    visibleSavedPlanUrls,
  ])

  const handleClearAllSavedPlanConflicts = useCallback(() => {
    setSavedPlanConflictDetailsByUrl({})
    setSavedPlanConflictSharedByUrl({})
    setSavedPlanConflictUrls([])
    setShareStatus({
      kind: 'success',
      message: 'Cleared all saved-plan conflict badges.',
    })
  }, [
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setShareStatus,
  ])

  return {
    clearSavedPlanConflictsForUrls,
    handleClearSavedPlanConflict,
    handleKeepVisibleSavedPlanConflictsLocal,
    handleClearAllSavedPlanConflicts,
  }
}
