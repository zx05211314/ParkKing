import {
  SAVED_PLAN_INTENTS,
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentSuggestion,
  type SavedPlanIntentSuggestionFilter,
  type SavedPlanIntentSuggestionSummary,
} from './savedPlanTypes'
import { TripBoardReviewCard } from './TripBoardReviewCard'

interface TripBoardSuggestedQueueProps {
  visibleSuggestedUntaggedSavedPlanQueue: SavedPlan[]
  visibleSuggestedUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  visibleUntaggedSavedPlanSuggestionSummaryText: string | null
  visibleUntaggedSavedPlanSuggestionByUrl: Map<string, SavedPlanIntentSuggestion>
  topSuggestedUntaggedSavedPlan: SavedPlan | null
  tripBoardIntentFilter: SavedPlanIntent | 'ALL' | 'UNTAGGED'
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  currentShareUrl: string | null
  onOpenTopSuggestedUntaggedSavedPlan: () => void
  onApplyVisibleSavedPlanIntentSuggestions: () => void
  onApplyVisibleSavedPlanIntentSuggestionsForIntent: (intent: SavedPlanIntent) => void
  onCompareSuggestedUntaggedSavedPlans: () => void
  onShowAllUntaggedSavedPlans: () => void
  onOpenSavedPlan: (url: string) => void
  onSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  formatSuggestionActionLabel: (intent: SavedPlanIntent, count: number) => string
}

export const TripBoardSuggestedQueue = ({
  visibleSuggestedUntaggedSavedPlanQueue,
  visibleSuggestedUntaggedSavedPlans,
  visibleUntaggedSavedPlanSuggestionSummary,
  visibleUntaggedSavedPlanSuggestionSummaryText,
  visibleUntaggedSavedPlanSuggestionByUrl,
  topSuggestedUntaggedSavedPlan,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  currentShareUrl,
  onOpenTopSuggestedUntaggedSavedPlan,
  onApplyVisibleSavedPlanIntentSuggestions,
  onApplyVisibleSavedPlanIntentSuggestionsForIntent,
  onCompareSuggestedUntaggedSavedPlans,
  onShowAllUntaggedSavedPlans,
  onOpenSavedPlan,
  onSetSavedPlanIntent,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  formatSuggestionActionLabel,
}: TripBoardSuggestedQueueProps) => {
  if (visibleSuggestedUntaggedSavedPlanQueue.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-snapshot">
      <div className="saved-plan-snapshot-header">
        <div>
          <div className="control-label">Suggested queue</div>
          <div className="control-meta">
            Top {visibleSuggestedUntaggedSavedPlanQueue.length} of{' '}
            {visibleSuggestedUntaggedSavedPlans.length} visible untagged plans with strong intent
            suggestions.
          </div>
          {visibleUntaggedSavedPlanSuggestionSummaryText ? (
            <div className="control-meta">{visibleUntaggedSavedPlanSuggestionSummaryText}</div>
          ) : null}
        </div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onOpenTopSuggestedUntaggedSavedPlan}
            disabled={!topSuggestedUntaggedSavedPlan}
          >
            Open top suggested
          </button>
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
                    key={`visible-queue-suggestion:${intent}`}
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
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onCompareSuggestedUntaggedSavedPlans}
            disabled={visibleSuggestedUntaggedSavedPlans.length < 2}
          >
            Compare top 2 suggested
          </button>
          {tripBoardIntentFilter !== 'UNTAGGED' || tripBoardSuggestionFilter !== 'ALL' ? (
            <button
              type="button"
              className="address-recommendations-action"
              onClick={onShowAllUntaggedSavedPlans}
            >
              Show all untagged
            </button>
          ) : null}
        </div>
      </div>
      <div className="saved-plan-snapshot-grid">
        {visibleSuggestedUntaggedSavedPlanQueue.map((plan) => (
          <TripBoardReviewCard
            key={`saved-plan-untagged:${plan.url}`}
            plan={plan}
            badgeLabel="Untagged"
            suggestion={visibleUntaggedSavedPlanSuggestionByUrl.get(plan.url) ?? null}
            currentShareUrl={currentShareUrl}
            onOpenSavedPlan={onOpenSavedPlan}
            onSetSavedPlanIntent={onSetSavedPlanIntent}
            getSavedPlanQualitySummary={getSavedPlanQualitySummary}
            getSavedPlanEtaSummary={getSavedPlanEtaSummary}
          />
        ))}
      </div>
    </div>
  )
}
