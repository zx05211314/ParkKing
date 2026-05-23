import { useSavedPlanConflictActions } from './useSavedPlanConflictActions'
import { useSavedPlanCrudActions } from './useSavedPlanCrudActions'
import { useSavedPlanIntentActions } from './useSavedPlanIntentActions'
import { useTripBoardFilterActions } from './useTripBoardFilterActions'
import type { UseTripBoardManagementActionsOptions } from './tripBoardManagementActionTypes'

type SavedPlanConflictActionOptions = Parameters<typeof useSavedPlanConflictActions>[0]
type TripBoardFilterActionOptions = Parameters<typeof useTripBoardFilterActions>[0]
type SavedPlanIntentActionOptions = Parameters<typeof useSavedPlanIntentActions>[0]
type SavedPlanCrudActionOptions = Parameters<typeof useSavedPlanCrudActions>[0]

export const buildSavedPlanConflictActionOptions = ({
  savedPlans,
  visibleSavedPlanUrls,
  savedPlanLimit,
  savedPlanConflictDetailsByUrl,
  setSavedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  setSavedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
}: UseTripBoardManagementActionsOptions): SavedPlanConflictActionOptions => ({
  savedPlans,
  visibleSavedPlanUrls,
  savedPlanLimit,
  savedPlanConflictDetailsByUrl,
  setSavedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  setSavedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
})

export const buildTripBoardFilterActionOptions = ({
  visibleSavedPlanGroupKeys,
  tripBoardIntentFilter,
  setTripBoardFilters,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setTripBoardQuery,
  setCollapsedSavedPlanGroups,
}: UseTripBoardManagementActionsOptions): TripBoardFilterActionOptions => ({
  visibleSavedPlanGroupKeys,
  tripBoardIntentFilter,
  setTripBoardFilters,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setTripBoardQuery,
  setCollapsedSavedPlanGroups,
})

export const buildSavedPlanIntentActionOptions = ({
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
}: UseTripBoardManagementActionsOptions & {
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}): SavedPlanIntentActionOptions => ({
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

export const buildSavedPlanCrudActionOptions = ({
  savedPlans,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanImportRef,
  savedPlanLimit,
  setSavedPlans,
  setSavedPlanConflictDetailsByUrl,
  setSavedPlanConflictSharedByUrl,
  setSavedPlanConflictUrls,
  setTripBoardQuery,
  setEditingSavedPlanUrl,
  setSavedPlanDraftTitle,
  setComparedSavedPlanUrls,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  resetSavedPlanConflictResolutionHistory,
}: UseTripBoardManagementActionsOptions & {
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  resetSavedPlanConflictResolutionHistory: () => void
}): SavedPlanCrudActionOptions => ({
  savedPlans,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanImportRef,
  savedPlanLimit,
  setSavedPlans,
  setSavedPlanConflictDetailsByUrl,
  setSavedPlanConflictSharedByUrl,
  setSavedPlanConflictUrls,
  setTripBoardQuery,
  setEditingSavedPlanUrl,
  setSavedPlanDraftTitle,
  setComparedSavedPlanUrls,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  resetSavedPlanConflictResolutionHistory,
})
