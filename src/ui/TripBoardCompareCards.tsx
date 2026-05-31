import { SAVED_PLAN_INTENT_LABELS, type SavedPlan } from './savedPlanTypes'

interface TripBoardCompareCardsProps {
  comparedSavedPlans: SavedPlan[]
  currentShareUrl: string | null
  onOpenSavedPlan: (url: string) => void
  onCopySavedPlanLink: (url: string) => void | Promise<void>
  onToggleSavedPlanCompare: (url: string) => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
  formatSavedPlanTimestamp: (value: string) => string
}

export const TripBoardCompareCards = ({
  comparedSavedPlans,
  currentShareUrl,
  onOpenSavedPlan,
  onCopySavedPlanLink,
  onToggleSavedPlanCompare,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
  formatSavedPlanTimestamp,
}: TripBoardCompareCardsProps) => (
  <div className="saved-plan-compare-cards">
    {comparedSavedPlans.map((plan) => (
      <div key={`compare:${plan.url}`} className="saved-plan-compare-card">
        <div className="saved-plan-compare-title">
          {plan.title}
          {plan.intent ? (
            <span className="search-result-badge intent">
              {SAVED_PLAN_INTENT_LABELS[plan.intent]}
            </span>
          ) : null}
          {plan.pinned ? <span className="search-result-badge favorite">Pinned</span> : null}
          {currentShareUrl === plan.url ? (
            <span className="search-result-badge pinned">Current</span>
          ) : null}
        </div>
        <div className="saved-plan-meta">
          {plan.datasetId ? <span>{plan.datasetId}</span> : null}
          {plan.addressLabel ? <span>{plan.addressLabel}</span> : null}
          {plan.segmentName ? <span>{plan.segmentName}</span> : null}
          {plan.targetLabel ? <span>{plan.targetLabel}</span> : null}
        </div>
        {getSavedPlanQualitySummary(plan).length > 0 ? (
          <div className="saved-plan-settings">
            {getSavedPlanQualitySummary(plan).map((chip) => (
              <span key={`compare-quality:${plan.url}:${chip}`}>{chip}</span>
            ))}
          </div>
        ) : null}
        {getSavedPlanEtaSummary(plan).length > 0 ? (
          <div className="saved-plan-settings">
            {getSavedPlanEtaSummary(plan).map((chip) => (
              <span key={`compare-eta:${plan.url}:${chip}`}>{chip}</span>
            ))}
          </div>
        ) : null}
        {getSavedPlanSettingChips(plan).length > 0 ? (
          <div className="saved-plan-settings">
            {getSavedPlanSettingChips(plan).map((chip) => (
              <span key={`compare-setting:${plan.url}:${chip}`}>{chip}</span>
            ))}
          </div>
        ) : null}
        <div className="control-meta">Saved: {formatSavedPlanTimestamp(plan.createdAt)}</div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onOpenSavedPlan(plan.url)}
          >
            Open
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => void onCopySavedPlanLink(plan.url)}
          >
            Copy link
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onToggleSavedPlanCompare(plan.url)}
          >
            Remove
          </button>
        </div>
      </div>
    ))}
    {comparedSavedPlans.length === 1 ? (
      <div className="saved-plan-compare-card placeholder">
        Pick another saved plan to fill this slot.
      </div>
    ) : null}
  </div>
)
