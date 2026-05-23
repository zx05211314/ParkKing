import { TripBoardSavedPlanGroupList } from './TripBoardSavedPlanGroupList'
import { getTripBoardSavedPlanGroupsEmptyMessage } from './tripBoardSavedPlanGroupsState'
import type { TripBoardSavedPlanGroupsProps } from './tripBoardSavedPlanGroupsTypes'

export const TripBoardSavedPlanGroups = ({
  savedPlans,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  visibleSavedPlans,
  visibleSavedPlanGroups,
  tripBoardQuery,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  hasActiveTripBoardFilters,
  datasetLabelById,
  collapsedSavedPlanGroups,
  comparedSavedPlanUrls,
  currentShareUrl,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanMetricLeaderBadges,
  onSavedPlanDraftTitleChange,
  onCommitSavedPlanRename,
  onCancelSavedPlanRename,
  onOpenSavedPlan,
  onToggleSavedPlanCompare,
  onStartSavedPlanRename,
  onSetSavedPlanIntent,
  onToggleSavedPlanPinned,
  onResolveSavedPlanConflictWithShared,
  onClearSavedPlanConflict,
  onCopySavedPlanLink,
  onRemoveSavedPlan,
  onOpenSavedPlanGroupTop,
  onCompareSavedPlanGroupTop,
  onCompareSavedPlanGroupLeaders,
  onPinSavedPlanGroupTop,
  onToggleSavedPlanGroupCollapsed,
  onCopySavedPlanGroupLinks,
  onApplySavedPlanGroupIntentSuggestions,
  onApplySavedPlanGroupIntentSuggestionsForIntent,
  onSetSavedPlanGroupIntent,
  formatSavedPlanTimestamp,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardSavedPlanGroupsProps) => {
  const savedPlanConflictUrlSet = new Set(savedPlanConflictUrls)

  if (savedPlans.length === 0) {
    return (
      <div className="saved-plan-empty">
        No saved plans yet. Save the current view or import a trip board file.
      </div>
    )
  }

  if (visibleSavedPlans.length === 0) {
    return (
      <div className="saved-plan-empty">
        {getTripBoardSavedPlanGroupsEmptyMessage(
          tripBoardQuery,
          tripBoardIntentFilter,
          tripBoardSuggestionFilter,
        )}
        {hasActiveTripBoardFilters ? ' Adjust or clear the board filters.' : ''}
      </div>
    )
  }

  return (
    <TripBoardSavedPlanGroupList
      savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
      savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
      visibleSavedPlanGroups={visibleSavedPlanGroups}
      datasetLabelById={datasetLabelById}
      collapsedSavedPlanGroups={collapsedSavedPlanGroups}
      comparedSavedPlanUrls={comparedSavedPlanUrls}
      currentShareUrl={currentShareUrl}
      editingSavedPlanUrl={editingSavedPlanUrl}
      savedPlanDraftTitle={savedPlanDraftTitle}
      savedPlanMetricLeaderBadges={savedPlanMetricLeaderBadges}
      savedPlanConflictUrlSet={savedPlanConflictUrlSet}
      onSavedPlanDraftTitleChange={onSavedPlanDraftTitleChange}
      onCommitSavedPlanRename={onCommitSavedPlanRename}
      onCancelSavedPlanRename={onCancelSavedPlanRename}
      onOpenSavedPlan={onOpenSavedPlan}
      onToggleSavedPlanCompare={onToggleSavedPlanCompare}
      onStartSavedPlanRename={onStartSavedPlanRename}
      onSetSavedPlanIntent={onSetSavedPlanIntent}
      onToggleSavedPlanPinned={onToggleSavedPlanPinned}
      onResolveSavedPlanConflictWithShared={onResolveSavedPlanConflictWithShared}
      onClearSavedPlanConflict={onClearSavedPlanConflict}
      onCopySavedPlanLink={onCopySavedPlanLink}
      onRemoveSavedPlan={onRemoveSavedPlan}
      onOpenSavedPlanGroupTop={onOpenSavedPlanGroupTop}
      onCompareSavedPlanGroupTop={onCompareSavedPlanGroupTop}
      onCompareSavedPlanGroupLeaders={onCompareSavedPlanGroupLeaders}
      onPinSavedPlanGroupTop={onPinSavedPlanGroupTop}
      onToggleSavedPlanGroupCollapsed={onToggleSavedPlanGroupCollapsed}
      onCopySavedPlanGroupLinks={onCopySavedPlanGroupLinks}
      onApplySavedPlanGroupIntentSuggestions={onApplySavedPlanGroupIntentSuggestions}
      onApplySavedPlanGroupIntentSuggestionsForIntent={
        onApplySavedPlanGroupIntentSuggestionsForIntent
      }
      onSetSavedPlanGroupIntent={onSetSavedPlanGroupIntent}
      formatSavedPlanTimestamp={formatSavedPlanTimestamp}
      formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
      formatSuggestionActionLabel={formatSuggestionActionLabel}
      getSavedPlanQualitySummary={getSavedPlanQualitySummary}
      getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      getSavedPlanSettingChips={getSavedPlanSettingChips}
    />
  )
}
