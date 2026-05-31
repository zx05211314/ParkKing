import type {
  ChangeEvent,
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react'
import type {
  FormatSavedPlanIntentSummary,
  SavedPlanIntentLabels,
} from './savedPlanIntentActionTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import type {
  SavedPlan,
  SavedPlanConflictFieldDetail,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionFilter,
  SavedPlanIntentSuggestionSummary,
  TripBoardFilters,
} from './savedPlanTypes'

export interface UseTripBoardManagementActionsOptions {
  savedPlans: SavedPlan[]
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  visibleUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestions: SavedPlanIntentSuggestionAssignment[]
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  visibleSavedPlanGroupKeys: string[]
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  savedPlanLimit: number
  savedPlanIntentLabels: SavedPlanIntentLabels
  savedPlanImportRef: RefObject<HTMLInputElement | null>
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  savedPlanConflictUrls: string[]
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setTripBoardFilters: Dispatch<SetStateAction<TripBoardFilters>>
  setTripBoardIntentFilter: Dispatch<SetStateAction<SavedPlanIntentFilter>>
  setTripBoardSuggestionFilter: Dispatch<
    SetStateAction<SavedPlanIntentSuggestionFilter>
  >
  setTripBoardQuery: Dispatch<SetStateAction<string>>
  setCollapsedSavedPlanGroups: Dispatch<SetStateAction<string[]>>
  setEditingSavedPlanUrl: Dispatch<SetStateAction<string | null>>
  setSavedPlanDraftTitle: Dispatch<SetStateAction<string>>
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  formatSavedPlanIntentSummary: FormatSavedPlanIntentSummary
}

export interface UseTripBoardManagementActionsResult {
  savedPlanConflictResolutionHistoryCount: number
  handleToggleTripBoardFilter: (key: keyof TripBoardFilters) => void
  handleSetTripBoardIntentFilter: (value: SavedPlanIntentFilter) => void
  handleSetTripBoardSuggestionFilter: (
    value: SavedPlanIntentSuggestionFilter,
  ) => void
  handleShowAllUntaggedSavedPlans: () => void
  handleResetTripBoardFilters: () => void
  handleClearTripBoardSearch: () => void
  handleToggleSavedPlanGroupCollapsed: (groupKey: string | null) => void
  handleCollapseAllSavedPlanGroups: () => void
  handleExpandAllSavedPlanGroups: () => void
  handleExportSavedPlans: () => void
  handleTriggerSavedPlanImport: () => void
  handleImportSavedPlans: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  handleStartSavedPlanRename: (plan: SavedPlan) => void
  handleCancelSavedPlanRename: () => void
  handleCommitSavedPlanRename: (url: string) => void
  handleToggleSavedPlanPinned: (plan: SavedPlan) => void
  handleSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  handleSetVisibleSavedPlanIntent: (intent: SavedPlanIntent | null) => void
  handleApplyVisibleSavedPlanIntentSuggestions: () => void
  handleApplyVisibleSavedPlanIntentSuggestionsForIntent: (
    intent: SavedPlanIntent,
  ) => void
  handleSetSavedPlanGroupIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent | null,
  ) => void
  handleApplySavedPlanGroupIntentSuggestions: (
    plans: SavedPlan[],
    groupLabel: string,
  ) => void
  handleApplySavedPlanGroupIntentSuggestionsForIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent,
  ) => void
  handleKeepVisibleSavedPlanConflictsLocal: () => void
  handleResolveVisibleSavedPlanConflictsWithShared: () => void
  handleResolveSavedPlanConflictWithShared: (url: string) => void
  handleUndoSavedPlanConflictResolution: () => void
  handleClearSavedPlanConflict: (url: string) => void
  handleClearAllSavedPlanConflicts: () => void
  handleRemoveSavedPlan: (url: string) => void
  handleClearSavedPlans: () => void
}
