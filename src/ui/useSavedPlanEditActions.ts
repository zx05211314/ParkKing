import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { removeSavedPlanByUrl, updateSavedPlanValue } from './savedPlanMutations'
import type { SavedPlan } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanEditActionsOptions {
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setEditingSavedPlanUrl: Dispatch<SetStateAction<string | null>>
  setSavedPlanDraftTitle: Dispatch<SetStateAction<string>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface UseSavedPlanEditActionsResult {
  handleStartSavedPlanRename: (plan: SavedPlan) => void
  handleCancelSavedPlanRename: () => void
  handleCommitSavedPlanRename: (url: string) => void
  handleToggleSavedPlanPinned: (plan: SavedPlan) => void
  handleRemoveSavedPlan: (url: string) => void
}

export const useSavedPlanEditActions = ({
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanLimit,
  setSavedPlans,
  setEditingSavedPlanUrl,
  setSavedPlanDraftTitle,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanEditActionsOptions): UseSavedPlanEditActionsResult => {
  const handleStartSavedPlanRename = useCallback(
    (plan: SavedPlan) => {
      setEditingSavedPlanUrl(plan.url)
      setSavedPlanDraftTitle(plan.title)
    },
    [setEditingSavedPlanUrl, setSavedPlanDraftTitle],
  )

  const handleCancelSavedPlanRename = useCallback(() => {
    setEditingSavedPlanUrl(null)
    setSavedPlanDraftTitle('')
  }, [setEditingSavedPlanUrl, setSavedPlanDraftTitle])

  const handleCommitSavedPlanRename = useCallback(
    (url: string) => {
      const nextTitle = savedPlanDraftTitle.trim()
      if (nextTitle.length === 0) {
        setShareStatus({
          kind: 'error',
          message: 'Saved plan title cannot be empty.',
        })
        return
      }

      setSavedPlans((current) =>
        updateSavedPlanValue(
          current,
          url,
          {
            title: nextTitle,
          },
          savedPlanLimit,
        ),
      )
      clearSavedPlanConflictsForUrls([url])
      setEditingSavedPlanUrl(null)
      setSavedPlanDraftTitle('')
      setShareStatus({
        kind: 'success',
        message: 'Saved plan renamed.',
      })
    },
    [
      clearSavedPlanConflictsForUrls,
      savedPlanDraftTitle,
      savedPlanLimit,
      setEditingSavedPlanUrl,
      setSavedPlanDraftTitle,
      setSavedPlans,
      setShareStatus,
    ],
  )

  const handleToggleSavedPlanPinned = useCallback(
    (plan: SavedPlan) => {
      setSavedPlans((current) =>
        updateSavedPlanValue(
          current,
          plan.url,
          {
            pinned: !plan.pinned,
          },
          savedPlanLimit,
        ),
      )
      clearSavedPlanConflictsForUrls([plan.url])
      setShareStatus({
        kind: 'success',
        message: plan.pinned ? 'Saved plan unpinned.' : 'Saved plan pinned.',
      })
    },
    [
      clearSavedPlanConflictsForUrls,
      savedPlanLimit,
      setSavedPlans,
      setShareStatus,
    ],
  )

  const handleRemoveSavedPlan = useCallback(
    (url: string) => {
      setSavedPlans((current) => removeSavedPlanByUrl(current, url))
      clearSavedPlanConflictsForUrls([url])
      setEditingSavedPlanUrl((current) => (current === url ? null : current))
      setSavedPlanDraftTitle((current) => (editingSavedPlanUrl === url ? '' : current))
    },
    [
      clearSavedPlanConflictsForUrls,
      editingSavedPlanUrl,
      setEditingSavedPlanUrl,
      setSavedPlanDraftTitle,
      setSavedPlans,
    ],
  )

  return {
    handleStartSavedPlanRename,
    handleCancelSavedPlanRename,
    handleCommitSavedPlanRename,
    handleToggleSavedPlanPinned,
    handleRemoveSavedPlan,
  }
}
