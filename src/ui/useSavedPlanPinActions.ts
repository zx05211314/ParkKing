import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { updateSavedPlanValue } from './savedPlanMutations'
import type { SavedPlan } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanPinActionsOptions {
  savedPlanLimit: number
  topPinCandidate: SavedPlan | null
  comparedSavedPlanLeader: SavedPlan | null
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanPinActionsResult {
  handlePinTopSavedPlan: () => void
  handlePinComparedSavedPlanLeader: () => void
  handlePinSavedPlanGroupTop: (plans: SavedPlan[]) => void
}

export const useSavedPlanPinActions = ({
  savedPlanLimit,
  topPinCandidate,
  comparedSavedPlanLeader,
  setSavedPlans,
  setShareStatus,
}: UseSavedPlanPinActionsOptions): UseSavedPlanPinActionsResult => {
  const handlePinTopSavedPlan = useCallback(() => {
    if (!topPinCandidate) {
      setShareStatus({
        kind: 'error',
        message: 'No visible saved plans to pin.',
      })
      return
    }
    if (topPinCandidate.pinned) {
      setShareStatus({
        kind: 'success',
        message: 'Top visible saved plan is already pinned.',
      })
      return
    }
    setSavedPlans((current) =>
      updateSavedPlanValue(
        current,
        topPinCandidate.url,
        {
          pinned: true,
        },
        savedPlanLimit,
      ),
    )
    setShareStatus({
      kind: 'success',
      message: 'Top visible saved plan pinned.',
    })
  }, [savedPlanLimit, setSavedPlans, setShareStatus, topPinCandidate])

  const handlePinComparedSavedPlanLeader = useCallback(() => {
    if (!comparedSavedPlanLeader) {
      setShareStatus({
        kind: 'error',
        message: 'No compare leader available.',
      })
      return
    }
    if (comparedSavedPlanLeader.pinned) {
      setShareStatus({
        kind: 'success',
        message: 'Compare leader is already pinned.',
      })
      return
    }
    setSavedPlans((current) =>
      updateSavedPlanValue(
        current,
        comparedSavedPlanLeader.url,
        {
          pinned: true,
        },
        savedPlanLimit,
      ),
    )
    setShareStatus({
      kind: 'success',
      message: 'Compare leader pinned.',
    })
  }, [comparedSavedPlanLeader, savedPlanLimit, setSavedPlans, setShareStatus])

  const handlePinSavedPlanGroupTop = useCallback(
    (plans: SavedPlan[]) => {
      const topPlan = plans[0]
      if (!topPlan) {
        setShareStatus({
          kind: 'error',
          message: 'No saved plans in that group to pin.',
        })
        return
      }
      if (topPlan.pinned) {
        setShareStatus({
          kind: 'success',
          message: 'Top saved plan in that group is already pinned.',
        })
        return
      }
      setSavedPlans((current) =>
        updateSavedPlanValue(
          current,
          topPlan.url,
          {
            pinned: true,
          },
          savedPlanLimit,
        ),
      )
      setShareStatus({
        kind: 'success',
        message: 'Top saved plan in that group pinned.',
      })
    },
    [savedPlanLimit, setSavedPlans, setShareStatus],
  )

  return {
    handlePinTopSavedPlan,
    handlePinComparedSavedPlanLeader,
    handlePinSavedPlanGroupTop,
  }
}
