import type { SavedPlan, SavedPlanGroup } from './savedPlanTypes'

interface TripBoardSavedPlanGroupHeaderProps {
  group: SavedPlanGroup
  groupLabel: string
  groupCollapsed: boolean
  groupSuggestionCount: number
  groupManualReviewCount: number
  groupLeaderCandidateCount: number
  topGroupPlan: SavedPlan | null
  onOpenSavedPlanGroupTop: (plans: SavedPlan[]) => void
  onCompareSavedPlanGroupTop: (plans: SavedPlan[]) => void
  onCompareSavedPlanGroupLeaders: (plans: SavedPlan[]) => void
  onPinSavedPlanGroupTop: (plans: SavedPlan[]) => void
  onToggleSavedPlanGroupCollapsed: (groupKey: string | null) => void
  onCopySavedPlanGroupLinks: (plans: SavedPlan[]) => void | Promise<void>
}

export const TripBoardSavedPlanGroupHeader = ({
  group,
  groupLabel,
  groupCollapsed,
  groupSuggestionCount,
  groupManualReviewCount,
  groupLeaderCandidateCount,
  topGroupPlan,
  onOpenSavedPlanGroupTop,
  onCompareSavedPlanGroupTop,
  onCompareSavedPlanGroupLeaders,
  onPinSavedPlanGroupTop,
  onToggleSavedPlanGroupCollapsed,
  onCopySavedPlanGroupLinks,
}: TripBoardSavedPlanGroupHeaderProps) => (
  <div className="saved-plan-group-header">
    <div className="saved-plan-group-copy">
      <div className="saved-plan-group-title">{groupLabel}</div>
      <div className="control-meta">
        {group.count} saved plan{group.count === 1 ? '' : 's'}
        {group.pinnedCount > 0 ? ` | ${group.pinnedCount} pinned` : ''}
        {groupSuggestionCount > 0 ? ` | ${groupSuggestionCount} suggested` : ''}
        {groupManualReviewCount > 0 ? ` | ${groupManualReviewCount} manual review` : ''}
      </div>
    </div>
    <div className="saved-plan-group-actions">
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onOpenSavedPlanGroupTop(group.plans)}
      >
        Open best
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onCompareSavedPlanGroupTop(group.plans)}
        disabled={group.plans.length < 2}
      >
        Compare top 2
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onCompareSavedPlanGroupLeaders(group.plans)}
        disabled={groupLeaderCandidateCount < 2}
      >
        Compare leaders
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onPinSavedPlanGroupTop(group.plans)}
        disabled={topGroupPlan === null || topGroupPlan.pinned}
      >
        Pin best
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onToggleSavedPlanGroupCollapsed(group.key)}
      >
        {groupCollapsed ? 'Expand' : 'Collapse'}
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => void onCopySavedPlanGroupLinks(group.plans)}
      >
        Copy links
      </button>
    </div>
  </div>
)
