interface TripBoardControlsActionBarProps {
  savedPlansCount: number
  hasTopVisibleSavedPlan: boolean
  onOpenTopSavedPlan: () => void
  onCopyTopSavedPlanLink: () => void | Promise<void>
  compareBoardActionLabel: string
  compareBoardSelectionLength: number
  onApplyVisibleSavedPlansToCompare: () => void
  canPinTopSavedPlan: boolean
  onPinTopSavedPlan: () => void
  onTriggerSavedPlanImport: () => void
  onExportSavedPlans: () => void | Promise<void>
  hasExpandedVisibleSavedPlanGroups: boolean
  hasCollapsedVisibleSavedPlanGroups: boolean
  onCollapseAllSavedPlanGroups: () => void
  onExpandAllSavedPlanGroups: () => void
  onClearSavedPlans: () => void
}

export const TripBoardControlsActionBar = ({
  savedPlansCount,
  hasTopVisibleSavedPlan,
  onOpenTopSavedPlan,
  onCopyTopSavedPlanLink,
  compareBoardActionLabel,
  compareBoardSelectionLength,
  onApplyVisibleSavedPlansToCompare,
  canPinTopSavedPlan,
  onPinTopSavedPlan,
  onTriggerSavedPlanImport,
  onExportSavedPlans,
  hasExpandedVisibleSavedPlanGroups,
  hasCollapsedVisibleSavedPlanGroups,
  onCollapseAllSavedPlanGroups,
  onExpandAllSavedPlanGroups,
  onClearSavedPlans,
}: TripBoardControlsActionBarProps) => (
  <div className="saved-plan-header-actions">
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onOpenTopSavedPlan}
      disabled={!hasTopVisibleSavedPlan}
    >
      Open top match
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={() => void onCopyTopSavedPlanLink()}
      disabled={!hasTopVisibleSavedPlan}
    >
      Copy top link
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onApplyVisibleSavedPlansToCompare}
      disabled={compareBoardSelectionLength < 2}
    >
      {compareBoardActionLabel}
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onPinTopSavedPlan}
      disabled={!canPinTopSavedPlan}
    >
      Pin top match
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onTriggerSavedPlanImport}
    >
      Import
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={() => void onExportSavedPlans()}
      disabled={savedPlansCount === 0}
    >
      Export
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onCollapseAllSavedPlanGroups}
      disabled={!hasExpandedVisibleSavedPlanGroups}
    >
      Collapse all
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onExpandAllSavedPlanGroups}
      disabled={!hasCollapsedVisibleSavedPlanGroups}
    >
      Expand all
    </button>
    <button
      type="button"
      className="address-recommendations-action"
      onClick={onClearSavedPlans}
      disabled={savedPlansCount === 0}
    >
      Clear all
    </button>
  </div>
)
