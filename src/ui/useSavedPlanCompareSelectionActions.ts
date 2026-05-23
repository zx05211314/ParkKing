import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanCompareSelectionActionsOptions {
  compareBoardSelection: string[]
  comparedSavedPlanUrls: string[]
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

interface UseSavedPlanCompareSelectionActionsResult {
  handleToggleSavedPlanCompare: (url: string) => void
  handleApplyVisibleSavedPlansToCompare: () => void
  handleClearComparedSavedPlans: () => void
}

export const useSavedPlanCompareSelectionActions = ({
  compareBoardSelection,
  comparedSavedPlanUrls,
  setComparedSavedPlanUrls,
  setShareStatus,
}: UseSavedPlanCompareSelectionActionsOptions): UseSavedPlanCompareSelectionActionsResult => {
  const handleToggleSavedPlanCompare = useCallback(
    (url: string) => {
      setComparedSavedPlanUrls((current) => {
        if (current.includes(url)) {
          return current.filter((entry) => entry !== url)
        }
        if (current.length >= 2) {
          return [current[current.length - 1], url]
        }
        return [...current, url]
      })
    },
    [setComparedSavedPlanUrls],
  )

  const handleApplyVisibleSavedPlansToCompare = useCallback(() => {
    if (compareBoardSelection.length < 2) {
      setShareStatus({
        kind: 'error',
        message: 'Need at least two visible saved plans to compare.',
      })
      return
    }

    const isUnchanged =
      compareBoardSelection.length === comparedSavedPlanUrls.length &&
      compareBoardSelection.every((url, index) => url === comparedSavedPlanUrls[index])

    if (isUnchanged) {
      setShareStatus({
        kind: 'success',
        message: 'Compare already matches the visible board.',
      })
      return
    }

    setComparedSavedPlanUrls(compareBoardSelection)
    setShareStatus({
      kind: 'success',
      message:
        comparedSavedPlanUrls.length === 1
          ? 'Compare filled from the visible board.'
          : 'Visible saved plans added to compare.',
    })
  }, [
    compareBoardSelection,
    comparedSavedPlanUrls,
    setComparedSavedPlanUrls,
    setShareStatus,
  ])

  const handleClearComparedSavedPlans = useCallback(() => {
    setComparedSavedPlanUrls([])
  }, [setComparedSavedPlanUrls])

  return {
    handleToggleSavedPlanCompare,
    handleApplyVisibleSavedPlansToCompare,
    handleClearComparedSavedPlans,
  }
}
