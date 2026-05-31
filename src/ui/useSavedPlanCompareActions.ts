import type { Dispatch, SetStateAction } from 'react'
import type { SavedPlan, SavedPlanIntent, TripBoardSortMode } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import { useSavedPlanCompareSelectionActions } from './useSavedPlanCompareSelectionActions'
import { useSavedPlanCompareTargetActions } from './useSavedPlanCompareTargetActions'

interface UseSavedPlanCompareActionsOptions {
  tripBoardSortMode: TripBoardSortMode
  compareBoardSelection: string[]
  comparedSavedPlanUrls: string[]
  visibleSavedPlanIntentLeaders: SavedPlan[]
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSuggestedUntaggedSavedPlans: SavedPlan[]
  visibleManualUntaggedSavedPlans: SavedPlan[]
  savedPlanIntentLabels: Record<SavedPlanIntent, string>
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanCompareActionsResult {
  handleToggleSavedPlanCompare: (url: string) => void
  handleApplyVisibleSavedPlansToCompare: () => void
  handleCompareSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  handleCompareSavedPlanIntentLeaders: () => void
  handleCompareConflictedSavedPlans: () => void
  handleCompareSuggestedUntaggedSavedPlans: () => void
  handleCompareManualUntaggedSavedPlans: () => void
  handleClearComparedSavedPlans: () => void
  handleCompareSavedPlanGroupTop: (plans: SavedPlan[]) => void
  handleCompareSavedPlanGroupLeaders: (plans: SavedPlan[]) => void
}

export const useSavedPlanCompareActions = ({
  tripBoardSortMode,
  compareBoardSelection,
  comparedSavedPlanUrls,
  visibleSavedPlanIntentLeaders,
  visibleConflictedSavedPlans,
  visibleSuggestedUntaggedSavedPlans,
  visibleManualUntaggedSavedPlans,
  savedPlanIntentLabels,
  setComparedSavedPlanUrls,
  setShareStatus,
}: UseSavedPlanCompareActionsOptions): UseSavedPlanCompareActionsResult => {
  const {
    handleToggleSavedPlanCompare,
    handleApplyVisibleSavedPlansToCompare,
    handleClearComparedSavedPlans,
  } = useSavedPlanCompareSelectionActions({
    compareBoardSelection,
    comparedSavedPlanUrls,
    setComparedSavedPlanUrls,
    setShareStatus,
  })

  const {
    handleCompareSavedPlanIntentTop,
    handleCompareSavedPlanIntentLeaders,
    handleCompareConflictedSavedPlans,
    handleCompareSuggestedUntaggedSavedPlans,
    handleCompareManualUntaggedSavedPlans,
    handleCompareSavedPlanGroupTop,
    handleCompareSavedPlanGroupLeaders,
  } = useSavedPlanCompareTargetActions({
    tripBoardSortMode,
    visibleSavedPlanIntentLeaders,
    visibleConflictedSavedPlans,
    visibleSuggestedUntaggedSavedPlans,
    visibleManualUntaggedSavedPlans,
    savedPlanIntentLabels,
    setComparedSavedPlanUrls,
    setShareStatus,
  })

  return {
    handleToggleSavedPlanCompare,
    handleApplyVisibleSavedPlansToCompare,
    handleCompareSavedPlanIntentTop,
    handleCompareSavedPlanIntentLeaders,
    handleCompareConflictedSavedPlans,
    handleCompareSuggestedUntaggedSavedPlans,
    handleCompareManualUntaggedSavedPlans,
    handleClearComparedSavedPlans,
    handleCompareSavedPlanGroupTop,
    handleCompareSavedPlanGroupLeaders,
  }
}
