interface TripBoardStatusBarProps {
  tripBoardStatusSummary: string | null
  hasTripBoardSearch: boolean
  hasActiveTripBoardFilters: boolean
  hiddenCollapsedSavedPlanCount: number
  onClearTripBoardSearch: () => void
  onResetTripBoardFilters: () => void
  onExpandAllSavedPlanGroups: () => void
}

export const TripBoardStatusBar = ({
  tripBoardStatusSummary,
  hasTripBoardSearch,
  hasActiveTripBoardFilters,
  hiddenCollapsedSavedPlanCount,
  onClearTripBoardSearch,
  onResetTripBoardFilters,
  onExpandAllSavedPlanGroups,
}: TripBoardStatusBarProps) => {
  if (!tripBoardStatusSummary) {
    return null
  }

  return (
    <div className="saved-plan-status-bar">
      <div className="control-meta">{tripBoardStatusSummary}</div>
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
      </div>
    </div>
  )
}
