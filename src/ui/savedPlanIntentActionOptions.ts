import { useSavedPlanIntentGroupActions } from './useSavedPlanIntentGroupActions'
import { useSavedPlanIntentSingleActions } from './useSavedPlanIntentSingleActions'
import { useSavedPlanIntentVisibleActions } from './useSavedPlanIntentVisibleActions'
import type { UseSavedPlanIntentActionsOptions } from './useSavedPlanIntentActions'

type SavedPlanIntentSingleActionOptions = Parameters<
  typeof useSavedPlanIntentSingleActions
>[0]
type SavedPlanIntentVisibleActionOptions = Parameters<
  typeof useSavedPlanIntentVisibleActions
>[0]
type SavedPlanIntentGroupActionOptions = Parameters<
  typeof useSavedPlanIntentGroupActions
>[0]

export const buildSavedPlanIntentSingleActionOptions = ({
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
}: UseSavedPlanIntentActionsOptions): SavedPlanIntentSingleActionOptions => ({
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
})

export const buildSavedPlanIntentVisibleActionOptions = ({
  visibleSavedPlans,
  visibleSavedPlanUrls,
  visibleUntaggedSavedPlans,
  visibleUntaggedSavedPlanSuggestions,
  visibleUntaggedSavedPlanSuggestionSummary,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  formatSavedPlanIntentSummary,
}: UseSavedPlanIntentActionsOptions): SavedPlanIntentVisibleActionOptions => ({
  visibleSavedPlans,
  visibleSavedPlanUrls,
  visibleUntaggedSavedPlans,
  visibleUntaggedSavedPlanSuggestions,
  visibleUntaggedSavedPlanSuggestionSummary,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  formatSavedPlanIntentSummary,
})

export const buildSavedPlanIntentGroupActionOptions = ({
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  formatSavedPlanIntentSummary,
}: UseSavedPlanIntentActionsOptions): SavedPlanIntentGroupActionOptions => ({
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  savedPlanLimit,
  savedPlanIntentLabels,
  setSavedPlans,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  formatSavedPlanIntentSummary,
})
