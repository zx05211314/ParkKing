import type {
  SavedPlan,
  SavedPlanConflictFieldDetail,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
} from './savedPlanTypes'
import { TripBoardSavedPlanGroups } from './TripBoardSavedPlanGroups'
import type { UseTripBoardResult } from './useTripBoard'
import type { UseTripBoardInteractionActionsResult } from './useTripBoardInteractionActions'
import type { UseTripBoardManagementActionsResult } from './useTripBoardManagementActions'

interface TripBoardSavedPlanGroupsSectionProps {
  savedPlans: SavedPlan[]
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
  currentShareUrl: string | null
  tripBoardState: UseTripBoardResult
  tripBoardActions: UseTripBoardInteractionActionsResult
  tripBoardManagementActions: UseTripBoardManagementActionsResult
  tripBoardQuery: string
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  datasetLabelById: Map<string, string>
  collapsedSavedPlanGroups: string[]
  comparedSavedPlanUrls: string[]
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  onSavedPlanDraftTitleChange: (value: string) => void
  formatSavedPlanTimestamp: (value: string) => string
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  formatSuggestionActionLabel: (intent: SavedPlanIntent, count: number) => string
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
}

export const TripBoardSavedPlanGroupsSection = ({
  savedPlans,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  currentShareUrl,
  tripBoardState,
  tripBoardActions,
  tripBoardManagementActions,
  tripBoardQuery,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  datasetLabelById,
  collapsedSavedPlanGroups,
  comparedSavedPlanUrls,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  onSavedPlanDraftTitleChange,
  formatSavedPlanTimestamp,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardSavedPlanGroupsSectionProps) => (
  <TripBoardSavedPlanGroups
    savedPlans={savedPlans}
    savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
    savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
    savedPlanConflictUrls={savedPlanConflictUrls}
    visibleSavedPlans={tripBoardState.visibleSavedPlans}
    visibleSavedPlanGroups={tripBoardState.visibleSavedPlanGroups}
    tripBoardQuery={tripBoardQuery}
    tripBoardIntentFilter={tripBoardIntentFilter}
    tripBoardSuggestionFilter={tripBoardSuggestionFilter}
    hasActiveTripBoardFilters={tripBoardState.hasActiveTripBoardFilters}
    datasetLabelById={datasetLabelById}
    collapsedSavedPlanGroups={collapsedSavedPlanGroups}
    comparedSavedPlanUrls={comparedSavedPlanUrls}
    currentShareUrl={currentShareUrl}
    editingSavedPlanUrl={editingSavedPlanUrl}
    savedPlanDraftTitle={savedPlanDraftTitle}
    savedPlanMetricLeaderBadges={tripBoardState.savedPlanMetricLeaderBadges}
    onSavedPlanDraftTitleChange={onSavedPlanDraftTitleChange}
    onCommitSavedPlanRename={tripBoardManagementActions.handleCommitSavedPlanRename}
    onCancelSavedPlanRename={tripBoardManagementActions.handleCancelSavedPlanRename}
    onOpenSavedPlan={tripBoardActions.handleOpenSavedPlan}
    onToggleSavedPlanCompare={tripBoardActions.handleToggleSavedPlanCompare}
    onStartSavedPlanRename={tripBoardManagementActions.handleStartSavedPlanRename}
    onSetSavedPlanIntent={tripBoardManagementActions.handleSetSavedPlanIntent}
    onToggleSavedPlanPinned={tripBoardManagementActions.handleToggleSavedPlanPinned}
    onResolveSavedPlanConflictWithShared={
      tripBoardManagementActions.handleResolveSavedPlanConflictWithShared
    }
    onClearSavedPlanConflict={tripBoardManagementActions.handleClearSavedPlanConflict}
    onCopySavedPlanLink={tripBoardActions.handleCopySavedPlanLink}
    onRemoveSavedPlan={tripBoardManagementActions.handleRemoveSavedPlan}
    onOpenSavedPlanGroupTop={tripBoardActions.handleOpenSavedPlanGroupTop}
    onCompareSavedPlanGroupTop={tripBoardActions.handleCompareSavedPlanGroupTop}
    onCompareSavedPlanGroupLeaders={tripBoardActions.handleCompareSavedPlanGroupLeaders}
    onPinSavedPlanGroupTop={tripBoardActions.handlePinSavedPlanGroupTop}
    onToggleSavedPlanGroupCollapsed={
      tripBoardManagementActions.handleToggleSavedPlanGroupCollapsed
    }
    onCopySavedPlanGroupLinks={tripBoardActions.handleCopySavedPlanGroupLinks}
    onApplySavedPlanGroupIntentSuggestions={
      tripBoardManagementActions.handleApplySavedPlanGroupIntentSuggestions
    }
    onApplySavedPlanGroupIntentSuggestionsForIntent={
      tripBoardManagementActions.handleApplySavedPlanGroupIntentSuggestionsForIntent
    }
    onSetSavedPlanGroupIntent={tripBoardManagementActions.handleSetSavedPlanGroupIntent}
    formatSavedPlanTimestamp={formatSavedPlanTimestamp}
    formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
    formatSuggestionActionLabel={formatSuggestionActionLabel}
    getSavedPlanQualitySummary={getSavedPlanQualitySummary}
    getSavedPlanEtaSummary={getSavedPlanEtaSummary}
    getSavedPlanSettingChips={getSavedPlanSettingChips}
  />
)
