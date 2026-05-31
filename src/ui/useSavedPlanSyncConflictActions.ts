import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type {
  SavedPlanConflictDetail,
  SavedPlan,
  SavedPlanConflictFieldDetail,
} from './savedPlanTypes'
import {
  clearSavedPlanConflictRecordUrls,
  clearSavedPlanConflictUrlList,
  mergeSavedPlanConflictDetailsByUrlValue,
  mergeSavedPlanConflictSharedPlansByUrlValue,
} from './savedPlanConflictState'

interface UseSavedPlanSyncConflictActionsOptions {
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
}

interface UseSavedPlanSyncConflictActionsResult {
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (
    details: SavedPlanConflictDetail[],
  ) => void
}

export const useSavedPlanSyncConflictActions = ({
  setSavedPlanConflictDetailsByUrl,
  setSavedPlanConflictSharedByUrl,
  setSavedPlanConflictUrls,
}: UseSavedPlanSyncConflictActionsOptions): UseSavedPlanSyncConflictActionsResult => {
  const mergeSavedPlanConflictDetails = useCallback(
    (details: SavedPlanConflictDetail[]) => {
      if (details.length === 0) {
        return
      }

      setSavedPlanConflictDetailsByUrl((currentConflictDetailsByUrl) =>
        mergeSavedPlanConflictDetailsByUrlValue(currentConflictDetailsByUrl, details),
      )
    },
    [setSavedPlanConflictDetailsByUrl],
  )

  const mergeSavedPlanConflictSharedPlans = useCallback(
    (details: SavedPlanConflictDetail[]) => {
      if (details.length === 0) {
        return
      }

      setSavedPlanConflictSharedByUrl((currentConflictSharedByUrl) =>
        mergeSavedPlanConflictSharedPlansByUrlValue(currentConflictSharedByUrl, details),
      )
    },
    [setSavedPlanConflictSharedByUrl],
  )

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

  return {
    clearSavedPlanConflictsForUrls,
    mergeSavedPlanConflictDetails,
    mergeSavedPlanConflictSharedPlans,
  }
}
