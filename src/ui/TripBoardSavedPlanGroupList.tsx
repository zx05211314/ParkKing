import { TripBoardSavedPlanGroupSection } from './TripBoardSavedPlanGroupSection'
import type { TripBoardSavedPlanGroupsProps } from './tripBoardSavedPlanGroupsTypes'

interface TripBoardSavedPlanGroupListProps
  extends Pick<
    TripBoardSavedPlanGroupsProps,
    | 'savedPlanConflictDetailsByUrl'
    | 'savedPlanConflictSharedByUrl'
    | 'visibleSavedPlanGroups'
    | 'datasetLabelById'
    | 'collapsedSavedPlanGroups'
    | 'comparedSavedPlanUrls'
    | 'currentShareUrl'
    | 'editingSavedPlanUrl'
    | 'savedPlanDraftTitle'
    | 'savedPlanMetricLeaderBadges'
    | 'onSavedPlanDraftTitleChange'
    | 'onCommitSavedPlanRename'
    | 'onCancelSavedPlanRename'
    | 'onOpenSavedPlan'
    | 'onToggleSavedPlanCompare'
    | 'onStartSavedPlanRename'
    | 'onSetSavedPlanIntent'
    | 'onToggleSavedPlanPinned'
    | 'onResolveSavedPlanConflictWithShared'
    | 'onClearSavedPlanConflict'
    | 'onCopySavedPlanLink'
    | 'onRemoveSavedPlan'
    | 'onOpenSavedPlanGroupTop'
    | 'onCompareSavedPlanGroupTop'
    | 'onCompareSavedPlanGroupLeaders'
    | 'onPinSavedPlanGroupTop'
    | 'onToggleSavedPlanGroupCollapsed'
    | 'onCopySavedPlanGroupLinks'
    | 'onApplySavedPlanGroupIntentSuggestions'
    | 'onApplySavedPlanGroupIntentSuggestionsForIntent'
    | 'onSetSavedPlanGroupIntent'
    | 'formatSavedPlanTimestamp'
    | 'formatSavedPlanIntentSummary'
    | 'formatSuggestionActionLabel'
    | 'getSavedPlanQualitySummary'
    | 'getSavedPlanEtaSummary'
    | 'getSavedPlanSettingChips'
  > {
  savedPlanConflictUrlSet: ReadonlySet<string>
}

export const TripBoardSavedPlanGroupList = ({
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  visibleSavedPlanGroups,
  datasetLabelById,
  collapsedSavedPlanGroups,
  comparedSavedPlanUrls,
  currentShareUrl,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanMetricLeaderBadges,
  savedPlanConflictUrlSet,
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
}: TripBoardSavedPlanGroupListProps) => (
  <div className="saved-plan-group-list">
    {visibleSavedPlanGroups.map((group) => (
      <TripBoardSavedPlanGroupSection
        key={`saved-plan-group:${group.key ?? 'unassigned'}`}
        group={group}
        datasetLabelById={datasetLabelById}
        collapsedSavedPlanGroups={collapsedSavedPlanGroups}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        currentShareUrl={currentShareUrl}
        editingSavedPlanUrl={editingSavedPlanUrl}
        savedPlanDraftTitle={savedPlanDraftTitle}
        savedPlanMetricLeaderBadges={savedPlanMetricLeaderBadges}
        savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
        savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
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
    ))}
  </div>
)
