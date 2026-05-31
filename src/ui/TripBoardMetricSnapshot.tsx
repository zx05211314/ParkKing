import {
  SAVED_PLAN_INTENT_LABELS,
  type SavedPlan,
  type SavedPlanMetricLeader,
} from './savedPlanTypes'

interface TripBoardMetricSnapshotProps {
  savedPlanMetricLeaders: SavedPlanMetricLeader[]
  currentShareUrl: string | null
  comparedSavedPlanUrls: string[]
  onOpenSavedPlan: (url: string) => void
  onToggleSavedPlanCompare: (url: string) => void
  onCopySavedPlanLink: (url: string) => void | Promise<void>
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
}

export const TripBoardMetricSnapshot = ({
  savedPlanMetricLeaders,
  currentShareUrl,
  comparedSavedPlanUrls,
  onOpenSavedPlan,
  onToggleSavedPlanCompare,
  onCopySavedPlanLink,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
}: TripBoardMetricSnapshotProps) => {
  if (savedPlanMetricLeaders.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-snapshot">
      <div className="saved-plan-snapshot-header">
        <div>
          <div className="control-label">Trip board snapshot</div>
          <div className="control-meta">
            Quick leaders across walk time, drive time, and parking quality.
          </div>
        </div>
      </div>
      <div className="saved-plan-snapshot-grid">
        {savedPlanMetricLeaders.map((leader) => (
          <div
            key={`saved-plan-leader:${leader.key}:${leader.plan.url}`}
            className="saved-plan-snapshot-card"
          >
            <div className="saved-plan-snapshot-title">
              <span className="search-result-badge favorite">{leader.label}</span>
              <span>{leader.plan.title}</span>
              {leader.plan.intent ? (
                <span className="search-result-badge intent">
                  {SAVED_PLAN_INTENT_LABELS[leader.plan.intent]}
                </span>
              ) : null}
              {leader.plan.pinned ? (
                <span className="search-result-badge favorite">Pinned</span>
              ) : null}
              {currentShareUrl === leader.plan.url ? (
                <span className="search-result-badge pinned">Current</span>
              ) : null}
            </div>
            <div className="saved-plan-meta">
              {leader.plan.datasetId ? <span>{leader.plan.datasetId}</span> : null}
              {leader.plan.addressLabel ? <span>{leader.plan.addressLabel}</span> : null}
              {leader.plan.segmentName ? <span>{leader.plan.segmentName}</span> : null}
              {leader.plan.targetLabel ? <span>{leader.plan.targetLabel}</span> : null}
            </div>
            {getSavedPlanQualitySummary(leader.plan).length > 0 ? (
              <div className="saved-plan-settings">
                {getSavedPlanQualitySummary(leader.plan).map((chip) => (
                  <span key={`saved-plan-leader-quality:${leader.key}:${leader.plan.url}:${chip}`}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            {getSavedPlanEtaSummary(leader.plan).length > 0 ? (
              <div className="saved-plan-settings">
                {getSavedPlanEtaSummary(leader.plan).map((chip) => (
                  <span key={`saved-plan-leader-eta:${leader.key}:${leader.plan.url}:${chip}`}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="saved-plan-compare-actions">
              <button
                type="button"
                className="address-recommendations-action"
                onClick={() => onOpenSavedPlan(leader.plan.url)}
              >
                Open
              </button>
              <button
                type="button"
                className={
                  comparedSavedPlanUrls.includes(leader.plan.url)
                    ? 'address-recommendations-action active'
                    : 'address-recommendations-action'
                }
                onClick={() => onToggleSavedPlanCompare(leader.plan.url)}
              >
                {comparedSavedPlanUrls.includes(leader.plan.url) ? 'Comparing' : 'Compare'}
              </button>
              <button
                type="button"
                className="address-recommendations-action"
                onClick={() => void onCopySavedPlanLink(leader.plan.url)}
              >
                Copy link
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
