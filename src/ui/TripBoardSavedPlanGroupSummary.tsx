import {
  SAVED_PLAN_INTENT_LABELS,
  SAVED_PLAN_INTENTS,
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentSuggestionSummary,
  type SavedPlanIntentSummary,
  type SavedPlanSummary,
} from './savedPlanTypes'

interface TripBoardSavedPlanGroupSummaryProps {
  group: SavedPlan[]
  groupLabel: string
  groupSummary: SavedPlanSummary
  groupIntentSummary: SavedPlanIntentSummary
  groupSuggestionSummary: SavedPlanIntentSuggestionSummary
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  formatSuggestionActionLabel: (intent: SavedPlanIntent, count: number) => string
  onApplySavedPlanGroupIntentSuggestions: (plans: SavedPlan[], groupLabel: string) => void
  onApplySavedPlanGroupIntentSuggestionsForIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent,
  ) => void
  onSetSavedPlanGroupIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent | null,
  ) => void
}

export const TripBoardSavedPlanGroupSummary = ({
  group,
  groupLabel,
  groupSummary,
  groupIntentSummary,
  groupSuggestionSummary,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  onApplySavedPlanGroupIntentSuggestions,
  onApplySavedPlanGroupIntentSuggestionsForIntent,
  onSetSavedPlanGroupIntent,
}: TripBoardSavedPlanGroupSummaryProps) => (
  <>
    <div className="saved-plan-group-summary">
      <span>{groupSummary.parkReadyCount} park ok</span>
      <span>{groupSummary.etaReadyCount} ETA ready</span>
      <span>{groupSummary.markedSpaceCount} with spaces</span>
      {groupIntentSummary.taggedCount > 0 || groupIntentSummary.unassignedCount > 0 ? (
        <span>
          Intents:{' '}
          {formatSavedPlanIntentSummary(
            groupIntentSummary,
            groupIntentSummary.unassignedCount,
          )}
        </span>
      ) : null}
      {groupSuggestionSummary.totalCount > 0 ? (
        <span>
          Suggestions: {formatSavedPlanIntentSummary(groupSuggestionSummary, 0)}
        </span>
      ) : null}
    </div>
    <div className="saved-plan-group-intents">
      <div className="control-meta">
        Tag this district group
        {groupSuggestionSummary.totalCount > 0
          ? `. ${groupSuggestionSummary.totalCount} untagged plan${groupSuggestionSummary.totalCount === 1 ? '' : 's'} can be auto-tagged.`
          : groupIntentSummary.unassignedCount > 0
            ? '. No strong auto-tag suggestions in this group yet.'
            : '.'}
      </div>
      <div className="saved-plan-filter-bar">
        <button
          type="button"
          className={
            groupSuggestionSummary.totalCount > 0
              ? 'address-recommendations-action active'
              : 'address-recommendations-action'
          }
          onClick={() => onApplySavedPlanGroupIntentSuggestions(group, groupLabel)}
          disabled={groupSuggestionSummary.totalCount === 0}
        >
          Apply suggestions
        </button>
        {SAVED_PLAN_INTENTS.flatMap((intent) =>
          groupSuggestionSummary[intent] > 0
            ? [
                <button
                  key={`saved-plan-group-intent-suggestion:${groupLabel}:${intent}`}
                  type="button"
                  className="address-recommendations-action active"
                  onClick={() =>
                    onApplySavedPlanGroupIntentSuggestionsForIntent(group, groupLabel, intent)
                  }
                >
                  {formatSuggestionActionLabel(intent, groupSuggestionSummary[intent])}
                </button>,
              ]
            : [],
        )}
        {SAVED_PLAN_INTENTS.map((intent) => (
          <button
            key={`saved-plan-group-intent:${groupLabel}:${intent}`}
            type="button"
            className="address-recommendations-action"
            onClick={() => onSetSavedPlanGroupIntent(group, groupLabel, intent)}
          >
            {SAVED_PLAN_INTENT_LABELS[intent]}
          </button>
        ))}
        <button
          type="button"
          className="address-recommendations-action"
          onClick={() => onSetSavedPlanGroupIntent(group, groupLabel, null)}
          disabled={groupIntentSummary.taggedCount === 0}
        >
          Clear intent
        </button>
      </div>
    </div>
  </>
)
