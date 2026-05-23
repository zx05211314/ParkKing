import {
  SAVED_PLAN_INTENT_LABELS,
  SAVED_PLAN_INTENTS,
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentSuggestion,
} from './savedPlanTypes'

interface TripBoardReviewCardProps {
  plan: SavedPlan
  badgeLabel: string
  suggestion?: SavedPlanIntentSuggestion | null
  currentShareUrl: string | null
  onOpenSavedPlan: (url: string) => void
  onSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
}

export const TripBoardReviewCard = ({
  plan,
  badgeLabel,
  suggestion,
  currentShareUrl,
  onOpenSavedPlan,
  onSetSavedPlanIntent,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
}: TripBoardReviewCardProps) => {
  const qualitySummary = getSavedPlanQualitySummary(plan)
  const etaSummary = getSavedPlanEtaSummary(plan)

  return (
    <div className="saved-plan-snapshot-card">
      <div className="saved-plan-snapshot-title">
        <span className="search-result-badge recent">{badgeLabel}</span>
        <span>{plan.title}</span>
        {suggestion ? (
          <span className="search-result-badge intent">
            Suggest {SAVED_PLAN_INTENT_LABELS[suggestion.intent]}
          </span>
        ) : null}
        {plan.pinned ? <span className="search-result-badge favorite">Pinned</span> : null}
        {currentShareUrl === plan.url ? (
          <span className="search-result-badge pinned">Current</span>
        ) : null}
      </div>
      <div className="control-meta">
        {suggestion ? suggestion.reason : 'No strong intent signal yet. Tag it manually.'}
      </div>
      <div className="saved-plan-meta">
        {plan.datasetId ? <span>{plan.datasetId}</span> : null}
        {plan.addressLabel ? <span>{plan.addressLabel}</span> : null}
        {plan.segmentName ? <span>{plan.segmentName}</span> : null}
        {plan.targetLabel ? <span>{plan.targetLabel}</span> : null}
      </div>
      {qualitySummary.length > 0 ? (
        <div className="saved-plan-settings">
          {qualitySummary.map((chip) => (
            <span key={`saved-plan-review-quality:${plan.url}:${chip}`}>{chip}</span>
          ))}
        </div>
      ) : null}
      {etaSummary.length > 0 ? (
        <div className="saved-plan-settings">
          {etaSummary.map((chip) => (
            <span key={`saved-plan-review-eta:${plan.url}:${chip}`}>{chip}</span>
          ))}
        </div>
      ) : null}
      <div className="saved-plan-compare-actions">
        <button
          type="button"
          className="address-recommendations-action"
          onClick={() => onOpenSavedPlan(plan.url)}
        >
          Open
        </button>
        {suggestion ? (
          <button
            type="button"
            className="address-recommendations-action active"
            onClick={() => onSetSavedPlanIntent(plan, suggestion.intent)}
          >
            Use {SAVED_PLAN_INTENT_LABELS[suggestion.intent]}
          </button>
        ) : null}
        {SAVED_PLAN_INTENTS.map((intent) => (
          <button
            key={`saved-plan-review-tag:${plan.url}:${intent}`}
            type="button"
            className="address-recommendations-action"
            onClick={() => onSetSavedPlanIntent(plan, intent)}
          >
            {SAVED_PLAN_INTENT_LABELS[intent]}
          </button>
        ))}
      </div>
    </div>
  )
}
