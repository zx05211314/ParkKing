import { useSavedPlanCompareActions } from './useSavedPlanCompareActions'
import { useSavedPlanLinkActions } from './useSavedPlanLinkActions'
import { useSavedPlanPinActions } from './useSavedPlanPinActions'
import {
  buildSavedPlanCompareActionOptions,
  buildSavedPlanLinkActionOptions,
  buildSavedPlanPinActionOptions,
} from './tripBoardInteractionActionOptions'
import type {
  UseTripBoardInteractionActionsOptions,
  UseTripBoardInteractionActionsResult,
} from './tripBoardInteractionActionTypes'

export type {
  UseTripBoardInteractionActionsOptions,
  UseTripBoardInteractionActionsResult,
} from './tripBoardInteractionActionTypes'

export const useTripBoardInteractionActions = ({
  applySharedState,
  savedPlanLimit,
  tripBoardSortMode,
  topVisibleSavedPlan,
  topSuggestedUntaggedSavedPlan,
  topManualUntaggedSavedPlan,
  visibleSavedPlanIntentLeaders,
  visibleConflictedSavedPlans,
  visibleSuggestedUntaggedSavedPlans,
  visibleManualUntaggedSavedPlans,
  compareBoardSelection,
  comparedSavedPlanUrls,
  topPinCandidate,
  comparedSavedPlans,
  comparedSavedPlanLeader,
  setShareStatus,
  setSavedPlans,
  setComparedSavedPlanUrls,
  savedPlanIntentLabels,
}: UseTripBoardInteractionActionsOptions): UseTripBoardInteractionActionsResult => {
  const options: UseTripBoardInteractionActionsOptions = {
    applySharedState,
    savedPlanLimit,
    tripBoardSortMode,
    topVisibleSavedPlan,
    topSuggestedUntaggedSavedPlan,
    topManualUntaggedSavedPlan,
    visibleSavedPlanIntentLeaders,
    visibleConflictedSavedPlans,
    visibleSuggestedUntaggedSavedPlans,
    visibleManualUntaggedSavedPlans,
    compareBoardSelection,
    comparedSavedPlanUrls,
    topPinCandidate,
    comparedSavedPlans,
    comparedSavedPlanLeader,
    setShareStatus,
    setSavedPlans,
    setComparedSavedPlanUrls,
    savedPlanIntentLabels,
  }

  const {
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
  } = useSavedPlanLinkActions(buildSavedPlanLinkActionOptions(options))
  const {
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
  } = useSavedPlanCompareActions(buildSavedPlanCompareActionOptions(options))
  const {
    handlePinTopSavedPlan,
    handlePinComparedSavedPlanLeader,
    handlePinSavedPlanGroupTop,
  } = useSavedPlanPinActions(buildSavedPlanPinActionOptions(options))

  return {
    handleOpenSavedPlan,
    handleCopySavedPlanLink,
    handleToggleSavedPlanCompare,
    handleApplyVisibleSavedPlansToCompare,
    handleOpenTopSavedPlan,
    handleOpenTopSuggestedUntaggedSavedPlan,
    handleOpenTopManualUntaggedSavedPlan,
    handleCopyTopSavedPlanLink,
    handleOpenSavedPlanIntentTop,
    handleCompareSavedPlanIntentTop,
    handleCopySavedPlanIntentLinks,
    handleCompareSavedPlanIntentLeaders,
    handleCompareConflictedSavedPlans,
    handleCopySavedPlanIntentLeaderLinks,
    handleCompareSuggestedUntaggedSavedPlans,
    handleCompareManualUntaggedSavedPlans,
    handlePinTopSavedPlan,
    handleClearComparedSavedPlans,
    handleCopyComparedSavedPlanLinks,
    handleOpenComparedSavedPlanLeader,
    handlePinComparedSavedPlanLeader,
    handleOpenSavedPlanGroupTop,
    handleCopySavedPlanGroupLinks,
    handlePinSavedPlanGroupTop,
    handleCompareSavedPlanGroupTop,
    handleCompareSavedPlanGroupLeaders,
  }
}
