import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { SavedPlan } from './savedPlanTypes'

export const useComparedSavedPlanCleanupEffect = (
  savedPlans: SavedPlan[],
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>,
) => {
  useEffect(() => {
    setComparedSavedPlanUrls((current) =>
      current.filter((url) => savedPlans.some((plan) => plan.url === url)),
    )
  }, [savedPlans, setComparedSavedPlanUrls])
}
