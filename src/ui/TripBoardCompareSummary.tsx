import {
  type SavedPlan,
  type SavedPlanComparisonHighlight,
  type TripBoardSortMode,
} from './savedPlanTypes'

interface TripBoardCompareSummaryProps {
  comparedSavedPlans: SavedPlan[]
  comparedSavedPlanLeader: SavedPlan | null
  savedPlanComparisonHighlights: SavedPlanComparisonHighlight[]
  tripBoardSortMode: TripBoardSortMode
  tripBoardSortModeLabels: Record<TripBoardSortMode, string>
  onOpenComparedSavedPlanLeader: () => void
  onPinComparedSavedPlanLeader: () => void
}

export const TripBoardCompareSummary = ({
  comparedSavedPlans,
  comparedSavedPlanLeader,
  savedPlanComparisonHighlights,
  tripBoardSortMode,
  tripBoardSortModeLabels,
  onOpenComparedSavedPlanLeader,
  onPinComparedSavedPlanLeader,
}: TripBoardCompareSummaryProps) => {
  if (!comparedSavedPlanLeader) {
    return null
  }

  return (
    <div className="saved-plan-compare-summary">
      <div className="saved-plan-compare-summary-header">
        <div>
          <div className="control-label">Compare summary</div>
          <div className="control-meta">
            Current leader by {tripBoardSortModeLabels[tripBoardSortMode]}:{' '}
            {comparedSavedPlanLeader.title}
          </div>
        </div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onOpenComparedSavedPlanLeader}
          >
            Open leader
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onPinComparedSavedPlanLeader}
            disabled={comparedSavedPlanLeader.pinned}
          >
            {comparedSavedPlanLeader.pinned ? 'Leader pinned' : 'Pin leader'}
          </button>
        </div>
      </div>
      <div className="saved-plan-compare-highlight-list">
        {savedPlanComparisonHighlights.length > 0 ? (
          savedPlanComparisonHighlights.map((highlight) => {
            const winningPlan =
              highlight.winner === 'left' ? comparedSavedPlans[0] : comparedSavedPlans[1]
            return (
              <div
                key={`compare-highlight:${highlight.label}`}
                className="saved-plan-compare-highlight"
              >
                <div className="saved-plan-compare-highlight-label">{highlight.label}</div>
                <div className="saved-plan-compare-highlight-body">
                  <span className="search-result-badge favorite">
                    {winningPlan?.title ?? 'Winner'}
                  </span>
                  <span>{highlight.summary}</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="control-meta">
            The compared plans are currently tied on ETA and parking quality.
          </div>
        )}
      </div>
    </div>
  )
}
