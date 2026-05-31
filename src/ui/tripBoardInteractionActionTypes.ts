import type { Dispatch, SetStateAction } from 'react'
import type { SavedPlan, SavedPlanIntent, TripBoardSortMode } from './savedPlanTypes'
import type { SharedAppState } from './shareState'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

export interface UseTripBoardInteractionActionsOptions {
  applySharedState: (state: SharedAppState) => void
  savedPlanLimit: number
  tripBoardSortMode: TripBoardSortMode
  topVisibleSavedPlan: SavedPlan | null
  topSuggestedUntaggedSavedPlan: SavedPlan | null
  topManualUntaggedSavedPlan: SavedPlan | null
  visibleSavedPlanIntentLeaders: SavedPlan[]
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSuggestedUntaggedSavedPlans: SavedPlan[]
  visibleManualUntaggedSavedPlans: SavedPlan[]
  compareBoardSelection: string[]
  comparedSavedPlanUrls: string[]
  topPinCandidate: SavedPlan | null
  comparedSavedPlans: SavedPlan[]
  comparedSavedPlanLeader: SavedPlan | null
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  savedPlanIntentLabels: Record<SavedPlanIntent, string>
}

export interface UseTripBoardInteractionActionsResult {
  handleOpenSavedPlan: (url: string) => void
  handleCopySavedPlanLink: (url: string) => Promise<void>
  handleToggleSavedPlanCompare: (url: string) => void
  handleApplyVisibleSavedPlansToCompare: () => void
  handleOpenTopSavedPlan: () => void
  handleOpenTopSuggestedUntaggedSavedPlan: () => void
  handleOpenTopManualUntaggedSavedPlan: () => void
  handleCopyTopSavedPlanLink: () => Promise<void>
  handleOpenSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  handleCompareSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  handleCopySavedPlanIntentLinks: (
    intent: SavedPlanIntent,
    plans: SavedPlan[],
  ) => Promise<void>
  handleCompareSavedPlanIntentLeaders: () => void
  handleCompareConflictedSavedPlans: () => void
  handleCopySavedPlanIntentLeaderLinks: () => Promise<void>
  handleCompareSuggestedUntaggedSavedPlans: () => void
  handleCompareManualUntaggedSavedPlans: () => void
  handlePinTopSavedPlan: () => void
  handleClearComparedSavedPlans: () => void
  handleCopyComparedSavedPlanLinks: () => Promise<void>
  handleOpenComparedSavedPlanLeader: () => void
  handlePinComparedSavedPlanLeader: () => void
  handleOpenSavedPlanGroupTop: (plans: SavedPlan[]) => void
  handleCopySavedPlanGroupLinks: (plans: SavedPlan[]) => Promise<void>
  handlePinSavedPlanGroupTop: (plans: SavedPlan[]) => void
  handleCompareSavedPlanGroupTop: (plans: SavedPlan[]) => void
  handleCompareSavedPlanGroupLeaders: (plans: SavedPlan[]) => void
}
