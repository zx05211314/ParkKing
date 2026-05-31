import type {
  SavedPlan,
  SavedPlanConflictFieldDetail,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
} from './savedPlanTypes'
import { TripBoardReviewQueues } from './TripBoardReviewQueues'
import { TripBoardSummaryPanels } from './TripBoardSummaryPanels'
import type { UseTripBoardResult } from './useTripBoard'
import type { UseTripBoardInteractionActionsResult } from './useTripBoardInteractionActions'
import type { UseTripBoardManagementActionsResult } from './useTripBoardManagementActions'

interface TripBoardReviewSummarySectionProps {
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
  currentShareUrl: string | null
  tripBoardState: UseTripBoardResult
  tripBoardActions: UseTripBoardInteractionActionsResult
  tripBoardManagementActions: UseTripBoardManagementActionsResult
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  comparedSavedPlanUrls: string[]
  hasTripBoardSearch: boolean
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

export const TripBoardReviewSummarySection = ({
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  currentShareUrl,
  tripBoardState,
  tripBoardActions,
  tripBoardManagementActions,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  comparedSavedPlanUrls,
  hasTripBoardSearch,
  formatSavedPlanTimestamp,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardReviewSummarySectionProps) => (
  <>
    <TripBoardReviewQueues
      visibleSavedPlans={tripBoardState.visibleSavedPlans}
      visibleSavedPlanIntentSummary={tripBoardState.visibleSavedPlanIntentSummary}
      visibleUntaggedSavedPlanSuggestionSummary={
        tripBoardState.visibleUntaggedSavedPlanSuggestionSummary
      }
      visibleUntaggedSavedPlanSuggestionSummaryText={
        tripBoardState.visibleUntaggedSavedPlanSuggestionSummaryText
      }
      visibleSuggestedUntaggedSavedPlanQueue={tripBoardState.visibleSuggestedUntaggedSavedPlanQueue}
      visibleSuggestedUntaggedSavedPlans={tripBoardState.visibleSuggestedUntaggedSavedPlans}
      visibleManualUntaggedSavedPlanQueue={tripBoardState.visibleManualUntaggedSavedPlanQueue}
      visibleManualUntaggedSavedPlans={tripBoardState.visibleManualUntaggedSavedPlans}
      visibleUntaggedSavedPlanSuggestionByUrl={
        tripBoardState.visibleUntaggedSavedPlanSuggestionByUrl
      }
      topSuggestedUntaggedSavedPlan={tripBoardState.topSuggestedUntaggedSavedPlan}
      topManualUntaggedSavedPlan={tripBoardState.topManualUntaggedSavedPlan}
      tripBoardIntentFilter={tripBoardIntentFilter}
      tripBoardSuggestionFilter={tripBoardSuggestionFilter}
      currentShareUrl={currentShareUrl}
      onApplyVisibleSavedPlanIntentSuggestions={
        tripBoardManagementActions.handleApplyVisibleSavedPlanIntentSuggestions
      }
      onApplyVisibleSavedPlanIntentSuggestionsForIntent={
        tripBoardManagementActions.handleApplyVisibleSavedPlanIntentSuggestionsForIntent
      }
      onSetVisibleSavedPlanIntent={tripBoardManagementActions.handleSetVisibleSavedPlanIntent}
      onSetTripBoardIntentFilter={tripBoardManagementActions.handleSetTripBoardIntentFilter}
      onOpenTopSuggestedUntaggedSavedPlan={tripBoardActions.handleOpenTopSuggestedUntaggedSavedPlan}
      onCompareSuggestedUntaggedSavedPlans={tripBoardActions.handleCompareSuggestedUntaggedSavedPlans}
      onShowAllUntaggedSavedPlans={tripBoardManagementActions.handleShowAllUntaggedSavedPlans}
      onOpenSavedPlan={tripBoardActions.handleOpenSavedPlan}
      onSetSavedPlanIntent={tripBoardManagementActions.handleSetSavedPlanIntent}
      onOpenTopManualUntaggedSavedPlan={tripBoardActions.handleOpenTopManualUntaggedSavedPlan}
      onCompareManualUntaggedSavedPlans={tripBoardActions.handleCompareManualUntaggedSavedPlans}
      getSavedPlanQualitySummary={getSavedPlanQualitySummary}
      getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
      formatSuggestionActionLabel={formatSuggestionActionLabel}
    />
    <TripBoardSummaryPanels
      savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
      savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
      savedPlanConflictUrls={savedPlanConflictUrls}
      savedPlanConflictResolutionHistoryCount={
        tripBoardManagementActions.savedPlanConflictResolutionHistoryCount
      }
      visibleConflictedSavedPlans={tripBoardState.visibleConflictedSavedPlans}
      visibleSavedPlanIntentGroups={tripBoardState.visibleSavedPlanIntentGroups}
      visibleSavedPlanUrls={tripBoardState.visibleSavedPlanUrls}
      visibleSavedPlanIntentLeaders={tripBoardState.visibleSavedPlanIntentLeaders}
      tripBoardIntentFilter={tripBoardIntentFilter}
      tripBoardStatusSummary={tripBoardState.tripBoardStatusSummary}
      hasTripBoardSearch={hasTripBoardSearch}
      hasActiveTripBoardFilters={tripBoardState.hasActiveTripBoardFilters}
      hiddenCollapsedSavedPlanCount={tripBoardState.hiddenCollapsedSavedPlanCount}
      savedPlanMetricLeaders={tripBoardState.savedPlanMetricLeaders}
      topVisibleSavedPlan={tripBoardState.topVisibleSavedPlan}
      currentShareUrl={currentShareUrl}
      comparedSavedPlanUrls={comparedSavedPlanUrls}
      onCompareSavedPlanIntentLeaders={tripBoardActions.handleCompareSavedPlanIntentLeaders}
      onCopySavedPlanIntentLeaderLinks={tripBoardActions.handleCopySavedPlanIntentLeaderLinks}
      onOpenSavedPlanIntentTop={tripBoardActions.handleOpenSavedPlanIntentTop}
      onCompareSavedPlanIntentTop={tripBoardActions.handleCompareSavedPlanIntentTop}
      onCopySavedPlanIntentLinks={tripBoardActions.handleCopySavedPlanIntentLinks}
      onSetTripBoardIntentFilter={tripBoardManagementActions.handleSetTripBoardIntentFilter}
      onClearTripBoardSearch={tripBoardManagementActions.handleClearTripBoardSearch}
      onResetTripBoardFilters={tripBoardManagementActions.handleResetTripBoardFilters}
      onExpandAllSavedPlanGroups={tripBoardManagementActions.handleExpandAllSavedPlanGroups}
      onClearAllSavedPlanConflicts={tripBoardManagementActions.handleClearAllSavedPlanConflicts}
      onUndoSavedPlanConflictResolution={
        tripBoardManagementActions.handleUndoSavedPlanConflictResolution
      }
      onKeepVisibleSavedPlanConflictsLocal={
        tripBoardManagementActions.handleKeepVisibleSavedPlanConflictsLocal
      }
      onResolveVisibleSavedPlanConflictsWithShared={
        tripBoardManagementActions.handleResolveVisibleSavedPlanConflictsWithShared
      }
      onResolveSavedPlanConflictWithShared={
        tripBoardManagementActions.handleResolveSavedPlanConflictWithShared
      }
      onClearSavedPlanConflict={tripBoardManagementActions.handleClearSavedPlanConflict}
      onCompareConflictedSavedPlans={tripBoardActions.handleCompareConflictedSavedPlans}
      onOpenSavedPlan={tripBoardActions.handleOpenSavedPlan}
      onToggleSavedPlanCompare={tripBoardActions.handleToggleSavedPlanCompare}
      onCopySavedPlanLink={tripBoardActions.handleCopySavedPlanLink}
      onOpenTopSavedPlan={tripBoardActions.handleOpenTopSavedPlan}
      onCopyTopSavedPlanLink={tripBoardActions.handleCopyTopSavedPlanLink}
      getSavedPlanQualitySummary={getSavedPlanQualitySummary}
      getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      getSavedPlanSettingChips={getSavedPlanSettingChips}
      formatSavedPlanTimestamp={formatSavedPlanTimestamp}
    />
  </>
)
