interface TripBoardConflictStatusBarProps {
  savedPlanConflictUrls: string[]
  visibleSavedPlanConflictCount: number
  visibleConflictFieldSummary: string
  hasTripBoardSearch: boolean
  hasActiveTripBoardFilters: boolean
  hiddenCollapsedSavedPlanCount: number
  savedPlanConflictResolutionHistoryCount: number
  visibleConflictedSavedPlansCount: number
  onClearTripBoardSearch: () => void
  onResetTripBoardFilters: () => void
  onExpandAllSavedPlanGroups: () => void
  onClearAllSavedPlanConflicts: () => void
  onUndoSavedPlanConflictResolution: () => void
  onKeepVisibleSavedPlanConflictsLocal: () => void
  onResolveVisibleSavedPlanConflictsWithShared: () => void
  onCompareConflictedSavedPlans: () => void
}

export const TripBoardConflictStatusBar = ({
  savedPlanConflictUrls,
  visibleSavedPlanConflictCount,
  visibleConflictFieldSummary,
  hasTripBoardSearch,
  hasActiveTripBoardFilters,
  hiddenCollapsedSavedPlanCount,
  savedPlanConflictResolutionHistoryCount,
  visibleConflictedSavedPlansCount,
  onClearTripBoardSearch,
  onResetTripBoardFilters,
  onExpandAllSavedPlanGroups,
  onClearAllSavedPlanConflicts,
  onUndoSavedPlanConflictResolution,
  onKeepVisibleSavedPlanConflictsLocal,
  onResolveVisibleSavedPlanConflictsWithShared,
  onCompareConflictedSavedPlans,
}: TripBoardConflictStatusBarProps) => {
  if (savedPlanConflictUrls.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-status-bar status-warning">
      <div className="control-meta">
        {visibleSavedPlanConflictCount > 0
          ? `${visibleSavedPlanConflictCount} visible saved plan${visibleSavedPlanConflictCount === 1 ? '' : 's'} were merged after conflicting shared edits. Review the conflict badges below.`
          : `${savedPlanConflictUrls.length} saved plan${savedPlanConflictUrls.length === 1 ? '' : 's'} were merged after conflicting shared edits. Adjust filters or expand groups to review them.`}
        {visibleConflictFieldSummary.length > 0
          ? ` Common differences: ${visibleConflictFieldSummary}.`
          : ''}
      </div>
      <div className="saved-plan-status-actions">
        {hasTripBoardSearch ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onClearTripBoardSearch}
          >
            Clear search
          </button>
        ) : null}
        {hasActiveTripBoardFilters ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onResetTripBoardFilters}
          >
            Clear filters
          </button>
        ) : null}
        {hiddenCollapsedSavedPlanCount > 0 ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onExpandAllSavedPlanGroups}
          >
            Show hidden groups
          </button>
        ) : null}
        <button
          type="button"
          className="address-recommendations-action"
          onClick={onClearAllSavedPlanConflicts}
        >
          Clear badges
        </button>
        {savedPlanConflictResolutionHistoryCount > 0 ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onUndoSavedPlanConflictResolution}
          >
            Undo last shared apply
          </button>
        ) : null}
        <button
          type="button"
          className="address-recommendations-action"
          onClick={onKeepVisibleSavedPlanConflictsLocal}
          disabled={visibleConflictedSavedPlansCount === 0}
        >
          Keep local for visible
        </button>
        <button
          type="button"
          className="address-recommendations-action"
          onClick={onResolveVisibleSavedPlanConflictsWithShared}
          disabled={visibleConflictedSavedPlansCount === 0}
        >
          Use shared for visible
        </button>
        <button
          type="button"
          className="address-recommendations-action"
          onClick={onCompareConflictedSavedPlans}
          disabled={visibleSavedPlanConflictCount < 2}
        >
          Compare conflicts
        </button>
      </div>
    </div>
  )
}
