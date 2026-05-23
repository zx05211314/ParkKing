import { TripBoardSavedPlanCardActions } from './TripBoardSavedPlanCardActions'
import { TripBoardSavedPlanCardMeta } from './TripBoardSavedPlanCardMeta'
import { TripBoardSavedPlanCardTitle } from './TripBoardSavedPlanCardTitle'
import type { TripBoardSavedPlanCardProps } from './tripBoardSavedPlanCardTypes'

export const TripBoardSavedPlanCard = ({
  plan,
  currentShareUrl,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  comparedSavedPlanUrls,
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
  formatSavedPlanTimestamp,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardSavedPlanCardProps) => {
  const hasConflict = savedPlanConflictUrlSet.has(plan.url)
  const conflictFields = savedPlanConflictDetailsByUrl[plan.url] ?? []

  return (
    <div className="saved-plan-card">
      <div className="saved-plan-main">
        <TripBoardSavedPlanCardTitle
          plan={plan}
          currentShareUrl={currentShareUrl}
          editingSavedPlanUrl={editingSavedPlanUrl}
          savedPlanDraftTitle={savedPlanDraftTitle}
          comparedSavedPlanUrls={comparedSavedPlanUrls}
          savedPlanMetricLeaderBadges={savedPlanMetricLeaderBadges}
          onSavedPlanDraftTitleChange={onSavedPlanDraftTitleChange}
          onCommitSavedPlanRename={onCommitSavedPlanRename}
          onCancelSavedPlanRename={onCancelSavedPlanRename}
          hasConflict={hasConflict}
        />
        <TripBoardSavedPlanCardMeta
          plan={plan}
          conflictFields={conflictFields}
          formatSavedPlanTimestamp={formatSavedPlanTimestamp}
          getSavedPlanQualitySummary={getSavedPlanQualitySummary}
          getSavedPlanEtaSummary={getSavedPlanEtaSummary}
          getSavedPlanSettingChips={getSavedPlanSettingChips}
        />
      </div>
      <TripBoardSavedPlanCardActions
        plan={plan}
        editingSavedPlanUrl={editingSavedPlanUrl}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
        onOpenSavedPlan={onOpenSavedPlan}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
        onStartSavedPlanRename={onStartSavedPlanRename}
        onSetSavedPlanIntent={onSetSavedPlanIntent}
        onToggleSavedPlanPinned={onToggleSavedPlanPinned}
        onResolveSavedPlanConflictWithShared={onResolveSavedPlanConflictWithShared}
        onClearSavedPlanConflict={onClearSavedPlanConflict}
        onCopySavedPlanLink={onCopySavedPlanLink}
        onRemoveSavedPlan={onRemoveSavedPlan}
        hasConflict={hasConflict}
      />
    </div>
  )
}
