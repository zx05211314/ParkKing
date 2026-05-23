import {
  SAVED_PLAN_INTENT_LABELS,
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentGroup,
} from './savedPlanTypes'

interface TripBoardIntentSnapshotProps {
  visibleSavedPlanIntentGroups: SavedPlanIntentGroup[]
  visibleSavedPlanIntentLeaders: SavedPlan[]
  tripBoardIntentFilter: SavedPlanIntent | 'ALL' | 'UNTAGGED'
  currentShareUrl: string | null
  onCompareSavedPlanIntentLeaders: () => void
  onCopySavedPlanIntentLeaderLinks: () => void | Promise<void>
  onOpenSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  onCompareSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  onCopySavedPlanIntentLinks: (
    intent: SavedPlanIntent,
    plans: SavedPlan[],
  ) => void | Promise<void>
  onSetTripBoardIntentFilter: (intent: SavedPlanIntent | 'ALL' | 'UNTAGGED') => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
}

export const TripBoardIntentSnapshot = ({
  visibleSavedPlanIntentGroups,
  visibleSavedPlanIntentLeaders,
  tripBoardIntentFilter,
  currentShareUrl,
  onCompareSavedPlanIntentLeaders,
  onCopySavedPlanIntentLeaderLinks,
  onOpenSavedPlanIntentTop,
  onCompareSavedPlanIntentTop,
  onCopySavedPlanIntentLinks,
  onSetTripBoardIntentFilter,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
}: TripBoardIntentSnapshotProps) => {
  if (visibleSavedPlanIntentGroups.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-snapshot">
      <div className="saved-plan-snapshot-header">
        <div>
          <div className="control-label">Intent snapshot</div>
          <div className="control-meta">
            Quick leaders for commute, pickup, and backup plans under the current board sort.
          </div>
        </div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onCompareSavedPlanIntentLeaders}
            disabled={visibleSavedPlanIntentLeaders.length < 2}
          >
            Compare leaders
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => void onCopySavedPlanIntentLeaderLinks()}
          >
            Copy leader links
          </button>
        </div>
      </div>
      <div className="saved-plan-snapshot-grid">
        {visibleSavedPlanIntentGroups.map((group) => (
          <div
            key={`saved-plan-intent:${group.intent}:${group.leader.url}`}
            className="saved-plan-snapshot-card"
          >
            <div className="saved-plan-snapshot-title">
              <span className="search-result-badge intent">
                {SAVED_PLAN_INTENT_LABELS[group.intent]}
              </span>
              <span>{group.leader.title}</span>
              {group.leader.pinned ? (
                <span className="search-result-badge favorite">Pinned</span>
              ) : null}
              {currentShareUrl === group.leader.url ? (
                <span className="search-result-badge pinned">Current</span>
              ) : null}
            </div>
            <div className="control-meta">
              {group.count} visible plan{group.count === 1 ? '' : 's'} tagged{' '}
              {SAVED_PLAN_INTENT_LABELS[group.intent].toLowerCase()}.
            </div>
            <div className="saved-plan-meta">
              {group.leader.datasetId ? <span>{group.leader.datasetId}</span> : null}
              {group.leader.addressLabel ? <span>{group.leader.addressLabel}</span> : null}
              {group.leader.segmentName ? <span>{group.leader.segmentName}</span> : null}
              {group.leader.targetLabel ? <span>{group.leader.targetLabel}</span> : null}
            </div>
            {getSavedPlanQualitySummary(group.leader).length > 0 ? (
              <div className="saved-plan-settings">
                {getSavedPlanQualitySummary(group.leader).map((chip) => (
                  <span
                    key={`saved-plan-intent-quality:${group.intent}:${group.leader.url}:${chip}`}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            {getSavedPlanEtaSummary(group.leader).length > 0 ? (
              <div className="saved-plan-settings">
                {getSavedPlanEtaSummary(group.leader).map((chip) => (
                  <span key={`saved-plan-intent-eta:${group.intent}:${group.leader.url}:${chip}`}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="saved-plan-compare-actions">
              <button
                type="button"
                className="address-recommendations-action"
                onClick={() => onOpenSavedPlanIntentTop(group.intent, group.plans)}
              >
                Open best
              </button>
              <button
                type="button"
                className="address-recommendations-action"
                onClick={() => onCompareSavedPlanIntentTop(group.intent, group.plans)}
                disabled={group.plans.length < 2}
              >
                Compare top 2
              </button>
              <button
                type="button"
                className="address-recommendations-action"
                onClick={() => void onCopySavedPlanIntentLinks(group.intent, group.plans)}
              >
                Copy links
              </button>
              <button
                type="button"
                className={
                  tripBoardIntentFilter === group.intent
                    ? 'address-recommendations-action active'
                    : 'address-recommendations-action'
                }
                onClick={() => onSetTripBoardIntentFilter(group.intent)}
              >
                {tripBoardIntentFilter === group.intent ? 'Showing only this intent' : 'Show only'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
