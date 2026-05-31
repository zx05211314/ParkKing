import {
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentSuggestionFilter,
} from './savedPlanTypes'
import { TripBoardReviewCard } from './TripBoardReviewCard'

interface TripBoardManualQueueProps {
  visibleManualUntaggedSavedPlanQueue: SavedPlan[]
  visibleManualUntaggedSavedPlans: SavedPlan[]
  topManualUntaggedSavedPlan: SavedPlan | null
  tripBoardIntentFilter: SavedPlanIntent | 'ALL' | 'UNTAGGED'
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  currentShareUrl: string | null
  onOpenTopManualUntaggedSavedPlan: () => void
  onCompareManualUntaggedSavedPlans: () => void
  onShowAllUntaggedSavedPlans: () => void
  onOpenSavedPlan: (url: string) => void
  onSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
}

export const TripBoardManualQueue = ({
  visibleManualUntaggedSavedPlanQueue,
  visibleManualUntaggedSavedPlans,
  topManualUntaggedSavedPlan,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  currentShareUrl,
  onOpenTopManualUntaggedSavedPlan,
  onCompareManualUntaggedSavedPlans,
  onShowAllUntaggedSavedPlans,
  onOpenSavedPlan,
  onSetSavedPlanIntent,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
}: TripBoardManualQueueProps) => {
  if (visibleManualUntaggedSavedPlanQueue.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-snapshot">
      <div className="saved-plan-snapshot-header">
        <div>
          <div className="control-label">Manual review queue</div>
          <div className="control-meta">
            Top {visibleManualUntaggedSavedPlanQueue.length} of{' '}
            {visibleManualUntaggedSavedPlans.length} visible untagged plans still need manual
            intent tagging.
          </div>
        </div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onOpenTopManualUntaggedSavedPlan}
            disabled={!topManualUntaggedSavedPlan}
          >
            Open top manual
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onCompareManualUntaggedSavedPlans}
            disabled={visibleManualUntaggedSavedPlans.length < 2}
          >
            Compare top 2 manual
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
        {visibleManualUntaggedSavedPlanQueue.map((plan) => (
          <TripBoardReviewCard
            key={`saved-plan-manual:${plan.url}`}
            plan={plan}
            badgeLabel="Manual"
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
