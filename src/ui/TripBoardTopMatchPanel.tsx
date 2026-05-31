import { SAVED_PLAN_INTENT_LABELS, type SavedPlan } from './savedPlanTypes'

interface TripBoardTopMatchPanelProps {
  topVisibleSavedPlan: SavedPlan | null
  currentShareUrl: string | null
  comparedSavedPlanUrls: string[]
  onOpenTopSavedPlan: () => void
  onToggleSavedPlanCompare: (url: string) => void
  onCopyTopSavedPlanLink: () => void | Promise<void>
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
  formatSavedPlanTimestamp: (value: string) => string
}

export const TripBoardTopMatchPanel = ({
  topVisibleSavedPlan,
  currentShareUrl,
  comparedSavedPlanUrls,
  onOpenTopSavedPlan,
  onToggleSavedPlanCompare,
  onCopyTopSavedPlanLink,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
  formatSavedPlanTimestamp,
}: TripBoardTopMatchPanelProps) => {
  if (!topVisibleSavedPlan) {
    return null
  }

  return (
    <div className="saved-plan-spotlight">
      <div className="saved-plan-spotlight-header">
        <div className="saved-plan-spotlight-copy">
          <div className="control-label">Top board match</div>
          <div className="control-meta">
            This plan is first under the current trip-board sort and filters.
          </div>
        </div>
        <div className="saved-plan-spotlight-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onOpenTopSavedPlan}
          >
            Open
          </button>
          <button
            type="button"
            className={
              comparedSavedPlanUrls.includes(topVisibleSavedPlan.url)
                ? 'address-recommendations-action active'
                : 'address-recommendations-action'
            }
            onClick={() => onToggleSavedPlanCompare(topVisibleSavedPlan.url)}
          >
            {comparedSavedPlanUrls.includes(topVisibleSavedPlan.url) ? 'Comparing' : 'Compare'}
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => void onCopyTopSavedPlanLink()}
          >
            Copy link
          </button>
        </div>
      </div>
      <div className="saved-plan-spotlight-title">
        {topVisibleSavedPlan.title}
        {topVisibleSavedPlan.intent ? (
          <span className="search-result-badge intent">
            {SAVED_PLAN_INTENT_LABELS[topVisibleSavedPlan.intent]}
          </span>
        ) : null}
        {topVisibleSavedPlan.pinned ? (
          <span className="search-result-badge favorite">Pinned</span>
        ) : null}
        {currentShareUrl === topVisibleSavedPlan.url ? (
          <span className="search-result-badge pinned">Current</span>
        ) : null}
      </div>
      <div className="saved-plan-meta">
        {topVisibleSavedPlan.datasetId ? <span>{topVisibleSavedPlan.datasetId}</span> : null}
        {topVisibleSavedPlan.addressLabel ? <span>{topVisibleSavedPlan.addressLabel}</span> : null}
        {topVisibleSavedPlan.segmentName ? <span>{topVisibleSavedPlan.segmentName}</span> : null}
        {topVisibleSavedPlan.targetLabel ? <span>{topVisibleSavedPlan.targetLabel}</span> : null}
      </div>
      {getSavedPlanQualitySummary(topVisibleSavedPlan).length > 0 ? (
        <div className="saved-plan-settings">
          {getSavedPlanQualitySummary(topVisibleSavedPlan).map((chip) => (
            <span key={`saved-plan-spotlight-quality:${topVisibleSavedPlan.url}:${chip}`}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      {getSavedPlanEtaSummary(topVisibleSavedPlan).length > 0 ? (
        <div className="saved-plan-settings">
          {getSavedPlanEtaSummary(topVisibleSavedPlan).map((chip) => (
            <span key={`saved-plan-spotlight-eta:${topVisibleSavedPlan.url}:${chip}`}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      {getSavedPlanSettingChips(topVisibleSavedPlan).length > 0 ? (
        <div className="saved-plan-settings">
          {getSavedPlanSettingChips(topVisibleSavedPlan).map((chip) => (
            <span key={`saved-plan-spotlight-setting:${topVisibleSavedPlan.url}:${chip}`}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      <div className="control-meta">
        Saved: {formatSavedPlanTimestamp(topVisibleSavedPlan.createdAt)}
      </div>
    </div>
  )
}
