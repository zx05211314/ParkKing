import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'

interface TripBoardConflictReviewQueueProps {
  visibleConflictedSavedPlans: SavedPlan[]
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  comparedSavedPlanUrls: string[]
  visibleSavedPlanConflictCount: number
  onCompareConflictedSavedPlans: () => void
  onOpenSavedPlan: (url: string) => void
  onToggleSavedPlanCompare: (url: string) => void
  onResolveSavedPlanConflictWithShared: (url: string) => void
  onClearSavedPlanConflict: (url: string) => void
}

export const TripBoardConflictReviewQueue = ({
  visibleConflictedSavedPlans,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  comparedSavedPlanUrls,
  visibleSavedPlanConflictCount,
  onCompareConflictedSavedPlans,
  onOpenSavedPlan,
  onToggleSavedPlanCompare,
  onResolveSavedPlanConflictWithShared,
  onClearSavedPlanConflict,
}: TripBoardConflictReviewQueueProps) => {
  if (visibleConflictedSavedPlans.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-snapshot">
      <div className="saved-plan-snapshot-header">
        <div>
          <div className="control-label">Conflict review</div>
          <div className="control-meta">
            Review merged shared-edit conflicts without leaving the current board view.
          </div>
        </div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onCompareConflictedSavedPlans}
            disabled={visibleSavedPlanConflictCount < 2}
          >
            Compare top conflicts
          </button>
        </div>
      </div>
      <div className="saved-plan-snapshot-grid">
        {visibleConflictedSavedPlans.slice(0, 3).map((plan) => {
          const conflictFields = savedPlanConflictDetailsByUrl[plan.url] ?? []

          return (
            <div key={`saved-plan-conflict-review:${plan.url}`} className="saved-plan-snapshot-card">
              <div className="saved-plan-snapshot-title">
                <span>{plan.title}</span>
                <span className="search-result-badge recent">Merged conflict</span>
              </div>
              <div className="saved-plan-meta">
                {plan.datasetId ? <span>{plan.datasetId}</span> : null}
                {plan.addressLabel ? <span>{plan.addressLabel}</span> : null}
                {plan.segmentName ? <span>{plan.segmentName}</span> : null}
                {plan.targetLabel ? <span>{plan.targetLabel}</span> : null}
              </div>
              {conflictFields.length > 0 ? (
                <div className="saved-plan-settings">
                  {conflictFields.map((field) => (
                    <span key={`saved-plan-conflict-review:${plan.url}:${field.label}`}>
                      {field.label}: kept {field.keptValue} / shared {field.sharedValue}
                    </span>
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
                <button
                  type="button"
                  className={
                    comparedSavedPlanUrls.includes(plan.url)
                      ? 'address-recommendations-action active'
                      : 'address-recommendations-action'
                  }
                  onClick={() => onToggleSavedPlanCompare(plan.url)}
                >
                  {comparedSavedPlanUrls.includes(plan.url) ? 'Comparing' : 'Compare'}
                </button>
                <button
                  type="button"
                  className="address-recommendations-action"
                  onClick={() => onResolveSavedPlanConflictWithShared(plan.url)}
                  disabled={!savedPlanConflictSharedByUrl[plan.url]}
                >
                  Use shared
                </button>
                <button
                  type="button"
                  className="address-recommendations-action"
                  onClick={() => onClearSavedPlanConflict(plan.url)}
                >
                  Keep local
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
