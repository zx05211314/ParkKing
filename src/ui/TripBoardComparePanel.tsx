import {
  type SavedPlan,
  type SavedPlanComparisonHighlight,
  type SavedPlanComparisonRow,
  type TripBoardSortMode,
} from './savedPlanTypes'
import { TripBoardCompareCards } from './TripBoardCompareCards'
import { TripBoardCompareSummary } from './TripBoardCompareSummary'
import { TripBoardCompareTable } from './TripBoardCompareTable'

interface TripBoardComparePanelProps {
  comparedSavedPlans: SavedPlan[]
  currentShareUrl: string | null
  tripBoardSortMode: TripBoardSortMode
  tripBoardSortModeLabels: Record<TripBoardSortMode, string>
  comparedSavedPlanLeader: SavedPlan | null
  savedPlanComparisonHighlights: SavedPlanComparisonHighlight[]
  savedPlanComparisonRows: SavedPlanComparisonRow[]
  compareBoardSelectionLength: number
  onCopyComparedSavedPlanLinks: () => void | Promise<void>
  onApplyVisibleSavedPlansToCompare: () => void
  onClearComparedSavedPlans: () => void
  onOpenSavedPlan: (url: string) => void
  onCopySavedPlanLink: (url: string) => void | Promise<void>
  onToggleSavedPlanCompare: (url: string) => void
  onOpenComparedSavedPlanLeader: () => void
  onPinComparedSavedPlanLeader: () => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
  formatSavedPlanTimestamp: (value: string) => string
}

export const TripBoardComparePanel = ({
  comparedSavedPlans,
  currentShareUrl,
  tripBoardSortMode,
  tripBoardSortModeLabels,
  comparedSavedPlanLeader,
  savedPlanComparisonHighlights,
  savedPlanComparisonRows,
  compareBoardSelectionLength,
  onCopyComparedSavedPlanLinks,
  onApplyVisibleSavedPlansToCompare,
  onClearComparedSavedPlans,
  onOpenSavedPlan,
  onCopySavedPlanLink,
  onToggleSavedPlanCompare,
  onOpenComparedSavedPlanLeader,
  onPinComparedSavedPlanLeader,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
  formatSavedPlanTimestamp,
}: TripBoardComparePanelProps) => {
  if (comparedSavedPlans.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-compare">
      <div className="saved-plan-compare-header">
        <div>
          <div className="control-label">Compare plans</div>
          <div className="control-meta">
            {comparedSavedPlans.length === 1
              ? 'Select one more saved plan to compare.'
              : 'Compare the selected parking plans side by side.'}
          </div>
        </div>
        <div className="saved-plan-compare-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => void onCopyComparedSavedPlanLinks()}
          >
            {comparedSavedPlans.length > 1 ? 'Copy compare links' : 'Copy compare link'}
          </button>
          {comparedSavedPlans.length === 1 ? (
            <button
              type="button"
              className="address-recommendations-action"
              onClick={onApplyVisibleSavedPlansToCompare}
              disabled={compareBoardSelectionLength < 2}
            >
              Fill compare
            </button>
          ) : null}
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onClearComparedSavedPlans}
          >
            Clear compare
          </button>
        </div>
      </div>
      <TripBoardCompareCards
        comparedSavedPlans={comparedSavedPlans}
        currentShareUrl={currentShareUrl}
        onOpenSavedPlan={onOpenSavedPlan}
        onCopySavedPlanLink={onCopySavedPlanLink}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
        getSavedPlanSettingChips={getSavedPlanSettingChips}
        formatSavedPlanTimestamp={formatSavedPlanTimestamp}
      />
      <TripBoardCompareSummary
        comparedSavedPlans={comparedSavedPlans}
        comparedSavedPlanLeader={comparedSavedPlanLeader}
        savedPlanComparisonHighlights={savedPlanComparisonHighlights}
        tripBoardSortMode={tripBoardSortMode}
        tripBoardSortModeLabels={tripBoardSortModeLabels}
        onOpenComparedSavedPlanLeader={onOpenComparedSavedPlanLeader}
        onPinComparedSavedPlanLeader={onPinComparedSavedPlanLeader}
      />
      <TripBoardCompareTable savedPlanComparisonRows={savedPlanComparisonRows} />
    </div>
  )
}
