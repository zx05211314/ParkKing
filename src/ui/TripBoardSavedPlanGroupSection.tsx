import { TripBoardSavedPlanCardList } from './TripBoardSavedPlanCardList'
import { TripBoardSavedPlanGroupHeader } from './TripBoardSavedPlanGroupHeader'
import { TripBoardSavedPlanGroupLeaders } from './TripBoardSavedPlanGroupLeaders'
import { TripBoardSavedPlanGroupSummary } from './TripBoardSavedPlanGroupSummary'
import { buildTripBoardSavedPlanGroupSectionState } from './tripBoardSavedPlanGroupSectionState'
import type { TripBoardSavedPlanGroupSectionProps } from './tripBoardSavedPlanGroupSectionTypes'

export const TripBoardSavedPlanGroupSection = ({
  group,
  datasetLabelById,
  collapsedSavedPlanGroups,
  comparedSavedPlanUrls,
  currentShareUrl,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanMetricLeaderBadges,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
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
}: TripBoardSavedPlanGroupSectionProps) => {
  const {
    groupLabel,
    groupSummary,
    groupIntentSummary,
    groupSuggestionSummary,
    groupManualReviewCount,
    groupMetricLeaders,
    groupLeaderCandidates,
    topGroupPlan,
    groupCollapsed,
  } = buildTripBoardSavedPlanGroupSectionState({
    group,
    datasetLabelById,
    collapsedSavedPlanGroups,
  })

  return (
    <div className="saved-plan-group">
      <TripBoardSavedPlanGroupHeader
        group={group}
        groupLabel={groupLabel}
        groupCollapsed={groupCollapsed}
        groupSuggestionCount={groupSuggestionSummary.totalCount}
        groupManualReviewCount={groupManualReviewCount}
        groupLeaderCandidateCount={groupLeaderCandidates.length}
        topGroupPlan={topGroupPlan}
        onOpenSavedPlanGroupTop={onOpenSavedPlanGroupTop}
        onCompareSavedPlanGroupTop={onCompareSavedPlanGroupTop}
        onCompareSavedPlanGroupLeaders={onCompareSavedPlanGroupLeaders}
        onPinSavedPlanGroupTop={onPinSavedPlanGroupTop}
        onToggleSavedPlanGroupCollapsed={onToggleSavedPlanGroupCollapsed}
        onCopySavedPlanGroupLinks={onCopySavedPlanGroupLinks}
      />
      {!groupCollapsed ? (
        <>
          <TripBoardSavedPlanGroupSummary
            group={group.plans}
            groupLabel={groupLabel}
            groupSummary={groupSummary}
            groupIntentSummary={groupIntentSummary}
            groupSuggestionSummary={groupSuggestionSummary}
            formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
            formatSuggestionActionLabel={formatSuggestionActionLabel}
            onApplySavedPlanGroupIntentSuggestions={onApplySavedPlanGroupIntentSuggestions}
            onApplySavedPlanGroupIntentSuggestionsForIntent={
              onApplySavedPlanGroupIntentSuggestionsForIntent
            }
            onSetSavedPlanGroupIntent={onSetSavedPlanGroupIntent}
          />
          <TripBoardSavedPlanGroupLeaders
            leaders={groupMetricLeaders}
            onOpenSavedPlan={onOpenSavedPlan}
          />
          <TripBoardSavedPlanCardList
            plans={group.plans}
            currentShareUrl={currentShareUrl}
            editingSavedPlanUrl={editingSavedPlanUrl}
            savedPlanDraftTitle={savedPlanDraftTitle}
            comparedSavedPlanUrls={comparedSavedPlanUrls}
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
            formatSavedPlanTimestamp={formatSavedPlanTimestamp}
            getSavedPlanQualitySummary={getSavedPlanQualitySummary}
            getSavedPlanEtaSummary={getSavedPlanEtaSummary}
            getSavedPlanSettingChips={getSavedPlanSettingChips}
          />
        </>
      ) : (
        <div className="control-meta">
          Group collapsed. {group.count} saved plan{group.count === 1 ? '' : 's'} hidden.
        </div>
      )}
    </div>
  )
}
