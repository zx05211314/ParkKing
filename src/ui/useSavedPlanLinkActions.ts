import type { Dispatch, SetStateAction } from 'react'
import type { SavedPlan, SavedPlanIntent } from './savedPlanTypes'
import type { SharedAppState } from './shareState'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import { useSavedPlanCopyLinkActions } from './useSavedPlanCopyLinkActions'
import { useSavedPlanOpenActions } from './useSavedPlanOpenActions'

interface UseSavedPlanLinkActionsOptions {
  applySharedState: (state: SharedAppState) => void
  topVisibleSavedPlan: SavedPlan | null
  topSuggestedUntaggedSavedPlan: SavedPlan | null
  topManualUntaggedSavedPlan: SavedPlan | null
  visibleSavedPlanIntentLeaders: SavedPlan[]
  comparedSavedPlans: SavedPlan[]
  comparedSavedPlanLeader: SavedPlan | null
  savedPlanIntentLabels: Record<SavedPlanIntent, string>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanLinkActionsResult {
  handleOpenSavedPlan: (url: string) => void
  handleCopySavedPlanLink: (url: string) => Promise<void>
  handleOpenTopSavedPlan: () => void
  handleOpenTopSuggestedUntaggedSavedPlan: () => void
  handleOpenTopManualUntaggedSavedPlan: () => void
  handleCopyTopSavedPlanLink: () => Promise<void>
  handleOpenSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  handleCopySavedPlanIntentLinks: (
    intent: SavedPlanIntent,
    plans: SavedPlan[],
  ) => Promise<void>
  handleCopySavedPlanIntentLeaderLinks: () => Promise<void>
  handleCopyComparedSavedPlanLinks: () => Promise<void>
  handleOpenComparedSavedPlanLeader: () => void
  handleOpenSavedPlanGroupTop: (plans: SavedPlan[]) => void
  handleCopySavedPlanGroupLinks: (plans: SavedPlan[]) => Promise<void>
}

export const useSavedPlanLinkActions = ({
  applySharedState,
  topVisibleSavedPlan,
  topSuggestedUntaggedSavedPlan,
  topManualUntaggedSavedPlan,
  visibleSavedPlanIntentLeaders,
  comparedSavedPlans,
  comparedSavedPlanLeader,
  savedPlanIntentLabels,
  setShareStatus,
}: UseSavedPlanLinkActionsOptions): UseSavedPlanLinkActionsResult => {
  const {
    handleOpenSavedPlan,
    handleOpenTopSavedPlan,
    handleOpenTopSuggestedUntaggedSavedPlan,
    handleOpenTopManualUntaggedSavedPlan,
    handleOpenSavedPlanIntentTop,
    handleOpenComparedSavedPlanLeader,
    handleOpenSavedPlanGroupTop,
  } = useSavedPlanOpenActions({
    applySharedState,
    topVisibleSavedPlan,
    topSuggestedUntaggedSavedPlan,
    topManualUntaggedSavedPlan,
    comparedSavedPlanLeader,
    savedPlanIntentLabels,
    setShareStatus,
  })
  const {
    handleCopySavedPlanLink,
    handleCopyTopSavedPlanLink,
    handleCopySavedPlanIntentLinks,
    handleCopySavedPlanIntentLeaderLinks,
    handleCopyComparedSavedPlanLinks,
    handleCopySavedPlanGroupLinks,
  } = useSavedPlanCopyLinkActions({
    topVisibleSavedPlan,
    visibleSavedPlanIntentLeaders,
    comparedSavedPlans,
    savedPlanIntentLabels,
    setShareStatus,
  })

  return {
    handleOpenSavedPlan,
    handleCopySavedPlanLink,
    handleOpenTopSavedPlan,
    handleOpenTopSuggestedUntaggedSavedPlan,
    handleOpenTopManualUntaggedSavedPlan,
    handleCopyTopSavedPlanLink,
    handleOpenSavedPlanIntentTop,
    handleCopySavedPlanIntentLinks,
    handleCopySavedPlanIntentLeaderLinks,
    handleCopyComparedSavedPlanLinks,
    handleOpenComparedSavedPlanLeader,
    handleOpenSavedPlanGroupTop,
    handleCopySavedPlanGroupLinks,
  }
}
