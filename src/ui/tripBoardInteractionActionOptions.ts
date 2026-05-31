import { useSavedPlanCompareActions } from './useSavedPlanCompareActions'
import { useSavedPlanLinkActions } from './useSavedPlanLinkActions'
import { useSavedPlanPinActions } from './useSavedPlanPinActions'
import type { UseTripBoardInteractionActionsOptions } from './tripBoardInteractionActionTypes'

type SavedPlanLinkActionOptions = Parameters<typeof useSavedPlanLinkActions>[0]
type SavedPlanCompareActionOptions = Parameters<typeof useSavedPlanCompareActions>[0]
type SavedPlanPinActionOptions = Parameters<typeof useSavedPlanPinActions>[0]

export const buildSavedPlanLinkActionOptions = ({
  applySharedState,
  topVisibleSavedPlan,
  topSuggestedUntaggedSavedPlan,
  topManualUntaggedSavedPlan,
  visibleSavedPlanIntentLeaders,
  comparedSavedPlans,
  comparedSavedPlanLeader,
  savedPlanIntentLabels,
  setShareStatus,
}: UseTripBoardInteractionActionsOptions): SavedPlanLinkActionOptions => ({
  applySharedState,
  topVisibleSavedPlan,
  topSuggestedUntaggedSavedPlan,
  topManualUntaggedSavedPlan,
  visibleSavedPlanIntentLeaders,
  comparedSavedPlans,
  comparedSavedPlanLeader,
  savedPlanIntentLabels,
  setShareStatus,
})

export const buildSavedPlanCompareActionOptions = ({
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
}: UseTripBoardInteractionActionsOptions): SavedPlanCompareActionOptions => ({
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
})

export const buildSavedPlanPinActionOptions = ({
  savedPlanLimit,
  topPinCandidate,
  comparedSavedPlanLeader,
  setSavedPlans,
  setShareStatus,
}: UseTripBoardInteractionActionsOptions): SavedPlanPinActionOptions => ({
  savedPlanLimit,
  topPinCandidate,
  comparedSavedPlanLeader,
  setSavedPlans,
  setShareStatus,
})
