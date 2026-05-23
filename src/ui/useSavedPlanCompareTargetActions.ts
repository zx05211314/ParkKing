import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { getSavedPlanLeaderCandidates, sortSavedPlans } from './savedPlanSort'
import type { SavedPlan, SavedPlanIntent, TripBoardSortMode } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanCompareTargetActionsOptions {
  tripBoardSortMode: TripBoardSortMode
  visibleSavedPlanIntentLeaders: SavedPlan[]
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSuggestedUntaggedSavedPlans: SavedPlan[]
  visibleManualUntaggedSavedPlans: SavedPlan[]
  savedPlanIntentLabels: Record<SavedPlanIntent, string>
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

interface UseSavedPlanCompareTargetActionsResult {
  handleCompareSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  handleCompareSavedPlanIntentLeaders: () => void
  handleCompareConflictedSavedPlans: () => void
  handleCompareSuggestedUntaggedSavedPlans: () => void
  handleCompareManualUntaggedSavedPlans: () => void
  handleCompareSavedPlanGroupTop: (plans: SavedPlan[]) => void
  handleCompareSavedPlanGroupLeaders: (plans: SavedPlan[]) => void
}

export const useSavedPlanCompareTargetActions = ({
  tripBoardSortMode,
  visibleSavedPlanIntentLeaders,
  visibleConflictedSavedPlans,
  visibleSuggestedUntaggedSavedPlans,
  visibleManualUntaggedSavedPlans,
  savedPlanIntentLabels,
  setComparedSavedPlanUrls,
  setShareStatus,
}: UseSavedPlanCompareTargetActionsOptions): UseSavedPlanCompareTargetActionsResult => {
  const publishError = useCallback(
    (message: string) => {
      setShareStatus({
        kind: 'error',
        message,
      })
    },
    [setShareStatus],
  )

  const publishSuccess = useCallback(
    (message: string) => {
      setShareStatus({
        kind: 'success',
        message,
      })
    },
    [setShareStatus],
  )

  const handleCompareSavedPlanIntentTop = useCallback(
    (intent: SavedPlanIntent, plans: SavedPlan[]) => {
      const intentLabel = savedPlanIntentLabels[intent].toLowerCase()
      if (plans.length < 2) {
        publishError(`Need at least two ${intentLabel} saved plans to compare.`)
        return
      }

      setComparedSavedPlanUrls(plans.slice(0, 2).map((plan) => plan.url))
      publishSuccess(`Top ${intentLabel} plans added to compare.`)
    },
    [publishError, publishSuccess, savedPlanIntentLabels, setComparedSavedPlanUrls],
  )

  const handleCompareSavedPlanIntentLeaders = useCallback(() => {
    const leaders = sortSavedPlans(visibleSavedPlanIntentLeaders, tripBoardSortMode).slice(0, 2)
    if (leaders.length < 2) {
      publishError('Need at least two visible intent leaders to compare.')
      return
    }

    setComparedSavedPlanUrls(leaders.map((plan) => plan.url))
    publishSuccess('Intent leaders added to compare.')
  }, [
    publishError,
    publishSuccess,
    setComparedSavedPlanUrls,
    tripBoardSortMode,
    visibleSavedPlanIntentLeaders,
  ])

  const handleCompareConflictedSavedPlans = useCallback(() => {
    if (visibleConflictedSavedPlans.length < 2) {
      publishError('Need at least two conflicted saved plans to compare.')
      return
    }

    setComparedSavedPlanUrls(visibleConflictedSavedPlans.slice(0, 2).map((plan) => plan.url))
    publishSuccess('Top conflicted saved plans added to compare.')
  }, [
    publishError,
    publishSuccess,
    setComparedSavedPlanUrls,
    visibleConflictedSavedPlans,
  ])

  const handleCompareSuggestedUntaggedSavedPlans = useCallback(() => {
    if (visibleSuggestedUntaggedSavedPlans.length < 2) {
      publishError('Need at least two suggested untagged saved plans to compare.')
      return
    }

    setComparedSavedPlanUrls(
      visibleSuggestedUntaggedSavedPlans.slice(0, 2).map((plan) => plan.url),
    )
    publishSuccess('Top suggested saved plans added to compare.')
  }, [
    publishError,
    publishSuccess,
    setComparedSavedPlanUrls,
    visibleSuggestedUntaggedSavedPlans,
  ])

  const handleCompareManualUntaggedSavedPlans = useCallback(() => {
    if (visibleManualUntaggedSavedPlans.length < 2) {
      publishError('Need at least two manual-review saved plans to compare.')
      return
    }

    setComparedSavedPlanUrls(
      visibleManualUntaggedSavedPlans.slice(0, 2).map((plan) => plan.url),
    )
    publishSuccess('Top manual-review saved plans added to compare.')
  }, [
    publishError,
    publishSuccess,
    setComparedSavedPlanUrls,
    visibleManualUntaggedSavedPlans,
  ])

  const handleCompareSavedPlanGroupTop = useCallback(
    (plans: SavedPlan[]) => {
      if (plans.length < 2) {
        publishError('Need at least two saved plans in that group to compare.')
        return
      }

      setComparedSavedPlanUrls(plans.slice(0, 2).map((plan) => plan.url))
      publishSuccess('Top group saved plans added to compare.')
    },
    [publishError, publishSuccess, setComparedSavedPlanUrls],
  )

  const handleCompareSavedPlanGroupLeaders = useCallback(
    (plans: SavedPlan[]) => {
      const leaderPlans = getSavedPlanLeaderCandidates(plans, 2)
      if (leaderPlans.length < 2) {
        publishError('Need at least two distinct leader plans in that group to compare.')
        return
      }

      setComparedSavedPlanUrls(leaderPlans.map((plan) => plan.url))
      publishSuccess('Group leader plans added to compare.')
    },
    [publishError, publishSuccess, setComparedSavedPlanUrls],
  )

  return {
    handleCompareSavedPlanIntentTop,
    handleCompareSavedPlanIntentLeaders,
    handleCompareConflictedSavedPlans,
    handleCompareSuggestedUntaggedSavedPlans,
    handleCompareManualUntaggedSavedPlans,
    handleCompareSavedPlanGroupTop,
    handleCompareSavedPlanGroupLeaders,
  }
}
