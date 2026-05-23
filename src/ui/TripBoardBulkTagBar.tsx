import {
  SAVED_PLAN_INTENT_LABELS,
  SAVED_PLAN_INTENTS,
  type SavedPlanIntent,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionSummary,
  type SavedPlanIntentSummary,
} from './savedPlanTypes'

interface TripBoardBulkTagBarProps {
  visibleSavedPlansCount: number
  visibleSavedPlanIntentSummary: SavedPlanIntentSummary
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  tripBoardIntentFilter: SavedPlanIntentFilter
  onApplyVisibleSavedPlanIntentSuggestions: () => void
  onApplyVisibleSavedPlanIntentSuggestionsForIntent: (intent: SavedPlanIntent) => void
  onSetVisibleSavedPlanIntent: (intent: SavedPlanIntent | null) => void
  onSetTripBoardIntentFilter: (intent: SavedPlanIntentFilter) => void
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  formatSuggestionActionLabel: (intent: SavedPlanIntent, count: number) => string
}

export const TripBoardBulkTagBar = ({
  visibleSavedPlansCount,
  visibleSavedPlanIntentSummary,
  visibleUntaggedSavedPlanSuggestionSummary,
  tripBoardIntentFilter,
  onApplyVisibleSavedPlanIntentSuggestions,
  onApplyVisibleSavedPlanIntentSuggestionsForIntent,
  onSetVisibleSavedPlanIntent,
  onSetTripBoardIntentFilter,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
}: TripBoardBulkTagBarProps) => {
  if (visibleSavedPlansCount === 0) {
    return null
  }

  return (
    <div className="saved-plan-bulk-bar">
      <div className="control-meta">
        Bulk tag visible plans
        {visibleSavedPlanIntentSummary.taggedCount > 0 ||
        visibleSavedPlanIntentSummary.unassignedCount > 0
          ? `: ${formatSavedPlanIntentSummary(
              visibleSavedPlanIntentSummary,
              visibleSavedPlanIntentSummary.unassignedCount,
            )}`
          : '.'}
      </div>
      <div className="saved-plan-filter-bar">
        <button
          type="button"
          className={
            visibleUntaggedSavedPlanSuggestionSummary.totalCount > 0
              ? 'address-recommendations-action active'
              : 'address-recommendations-action'
          }
          onClick={onApplyVisibleSavedPlanIntentSuggestions}
          disabled={visibleUntaggedSavedPlanSuggestionSummary.totalCount === 0}
        >
          Apply suggestions
        </button>
        {SAVED_PLAN_INTENTS.flatMap((intent) =>
          visibleUntaggedSavedPlanSuggestionSummary[intent] > 0
            ? [
                <button
                  key={`visible-intent-suggestion:${intent}`}
                  type="button"
                  className="address-recommendations-action active"
                  onClick={() => onApplyVisibleSavedPlanIntentSuggestionsForIntent(intent)}
                >
                  {formatSuggestionActionLabel(
                    intent,
                    visibleUntaggedSavedPlanSuggestionSummary[intent],
                  )}
                </button>,
              ]
            : [],
        )}
        {SAVED_PLAN_INTENTS.map((intent) => (
          <button
            key={`visible-intent:${intent}`}
            type="button"
            className="address-recommendations-action"
            onClick={() => onSetVisibleSavedPlanIntent(intent)}
          >
            {SAVED_PLAN_INTENT_LABELS[intent]}
          </button>
        ))}
        <button
          type="button"
          className="address-recommendations-action"
          onClick={() => onSetVisibleSavedPlanIntent(null)}
          disabled={visibleSavedPlanIntentSummary.taggedCount === 0}
        >
          Clear intent
        </button>
        {visibleSavedPlanIntentSummary.unassignedCount > 0 &&
        tripBoardIntentFilter !== 'UNTAGGED' ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onSetTripBoardIntentFilter('UNTAGGED')}
          >
            Show untagged
          </button>
        ) : null}
      </div>
    </div>
  )
}
