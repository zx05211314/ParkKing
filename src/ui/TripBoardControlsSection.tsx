import type { RefObject } from 'react'
import { TripBoardComparePanel } from './TripBoardComparePanel'
import { TripBoardControls } from './TripBoardControls'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
  TripBoardFilters,
  TripBoardSortMode,
} from './savedPlanTypes'
import type { UseTripBoardResult } from './useTripBoard'
import type { UseTripBoardInteractionActionsResult } from './useTripBoardInteractionActions'
import type { UseTripBoardManagementActionsResult } from './useTripBoardManagementActions'

interface TripBoardControlsSectionProps {
  savedPlans: SavedPlan[]
  currentShareUrl: string | null
  tripBoardState: UseTripBoardResult
  tripBoardActions: UseTripBoardInteractionActionsResult
  tripBoardManagementActions: UseTripBoardManagementActionsResult
  tripBoardSortMode: TripBoardSortMode
  tripBoardSortModeLabels: Record<TripBoardSortMode, string>
  onTripBoardSortModeChange: (mode: TripBoardSortMode) => void
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardIntentFilterLabels: Record<SavedPlanIntentFilter, string>
  savedPlanIntents: SavedPlanIntent[]
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardSuggestionFilterLabels: Record<SavedPlanIntentSuggestionFilter, string>
  tripBoardQuery: string
  onTripBoardQueryChange: (value: string) => void
  tripBoardFilterLabels: Record<keyof TripBoardFilters, string>
  tripBoardFilters: TripBoardFilters
  savedPlanImportRef: RefObject<HTMLInputElement | null>
  formatSavedPlanTimestamp: (value: string) => string
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
}

export const TripBoardControlsSection = ({
  savedPlans,
  currentShareUrl,
  tripBoardState,
  tripBoardActions,
  tripBoardManagementActions,
  tripBoardSortMode,
  tripBoardSortModeLabels,
  onTripBoardSortModeChange,
  tripBoardIntentFilter,
  tripBoardIntentFilterLabels,
  savedPlanIntents,
  tripBoardSuggestionFilter,
  tripBoardSuggestionFilterLabels,
  tripBoardQuery,
  onTripBoardQueryChange,
  tripBoardFilterLabels,
  tripBoardFilters,
  savedPlanImportRef,
  formatSavedPlanTimestamp,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardControlsSectionProps) => (
  <TripBoardControls
    savedPlansCount={savedPlans.length}
    tripBoardSortMode={tripBoardSortMode}
    tripBoardSortModeLabels={tripBoardSortModeLabels}
    onTripBoardSortModeChange={onTripBoardSortModeChange}
    tripBoardIntentFilter={tripBoardIntentFilter}
    tripBoardIntentFilterLabels={tripBoardIntentFilterLabels}
    savedPlanIntents={savedPlanIntents}
    onSetTripBoardIntentFilter={tripBoardManagementActions.handleSetTripBoardIntentFilter}
    visibleSavedPlanIntentSummary={tripBoardState.visibleSavedPlanIntentSummary}
    tripBoardSuggestionFilter={tripBoardSuggestionFilter}
    tripBoardSuggestionFilterLabels={tripBoardSuggestionFilterLabels}
    tripBoardSuggestionFilterSummary={tripBoardState.tripBoardSuggestionFilterSummary}
    onSetTripBoardSuggestionFilter={
      tripBoardManagementActions.handleSetTripBoardSuggestionFilter
    }
    hasTopVisibleSavedPlan={Boolean(tripBoardState.topVisibleSavedPlan)}
    onOpenTopSavedPlan={tripBoardActions.handleOpenTopSavedPlan}
    onCopyTopSavedPlanLink={tripBoardActions.handleCopyTopSavedPlanLink}
    compareBoardActionLabel={tripBoardState.compareBoardActionLabel}
    compareBoardSelectionLength={tripBoardState.compareBoardSelection.length}
    onApplyVisibleSavedPlansToCompare={tripBoardActions.handleApplyVisibleSavedPlansToCompare}
    canPinTopSavedPlan={Boolean(
      tripBoardState.topPinCandidate && !tripBoardState.topPinCandidate.pinned,
    )}
    onPinTopSavedPlan={tripBoardActions.handlePinTopSavedPlan}
    onTriggerSavedPlanImport={tripBoardManagementActions.handleTriggerSavedPlanImport}
    onExportSavedPlans={tripBoardManagementActions.handleExportSavedPlans}
    hasExpandedVisibleSavedPlanGroups={tripBoardState.hasExpandedVisibleSavedPlanGroups}
    hasCollapsedVisibleSavedPlanGroups={tripBoardState.hasCollapsedVisibleSavedPlanGroups}
    onCollapseAllSavedPlanGroups={tripBoardManagementActions.handleCollapseAllSavedPlanGroups}
    onExpandAllSavedPlanGroups={tripBoardManagementActions.handleExpandAllSavedPlanGroups}
    onClearSavedPlans={tripBoardManagementActions.handleClearSavedPlans}
    savedPlanImportRef={savedPlanImportRef}
    onImportSavedPlans={(event) => {
      void tripBoardManagementActions.handleImportSavedPlans(event)
    }}
    tripBoardQuery={tripBoardQuery}
    onTripBoardQueryChange={onTripBoardQueryChange}
    tripBoardFilterLabels={tripBoardFilterLabels}
    tripBoardFilters={tripBoardFilters}
    onToggleTripBoardFilter={tripBoardManagementActions.handleToggleTripBoardFilter}
    hasActiveTripBoardFilters={tripBoardState.hasActiveTripBoardFilters}
    onResetTripBoardFilters={tripBoardManagementActions.handleResetTripBoardFilters}
  >
    <TripBoardComparePanel
      comparedSavedPlans={tripBoardState.comparedSavedPlans}
      currentShareUrl={currentShareUrl}
      tripBoardSortMode={tripBoardSortMode}
      tripBoardSortModeLabels={tripBoardSortModeLabels}
      comparedSavedPlanLeader={tripBoardState.comparedSavedPlanLeader}
      savedPlanComparisonHighlights={tripBoardState.savedPlanComparisonHighlights}
      savedPlanComparisonRows={tripBoardState.savedPlanComparisonRows}
      compareBoardSelectionLength={tripBoardState.compareBoardSelection.length}
      onCopyComparedSavedPlanLinks={tripBoardActions.handleCopyComparedSavedPlanLinks}
      onApplyVisibleSavedPlansToCompare={tripBoardActions.handleApplyVisibleSavedPlansToCompare}
      onClearComparedSavedPlans={tripBoardActions.handleClearComparedSavedPlans}
      onOpenSavedPlan={tripBoardActions.handleOpenSavedPlan}
      onCopySavedPlanLink={tripBoardActions.handleCopySavedPlanLink}
      onToggleSavedPlanCompare={tripBoardActions.handleToggleSavedPlanCompare}
      onOpenComparedSavedPlanLeader={tripBoardActions.handleOpenComparedSavedPlanLeader}
      onPinComparedSavedPlanLeader={tripBoardActions.handlePinComparedSavedPlanLeader}
      getSavedPlanQualitySummary={getSavedPlanQualitySummary}
      getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      getSavedPlanSettingChips={getSavedPlanSettingChips}
      formatSavedPlanTimestamp={formatSavedPlanTimestamp}
    />
  </TripBoardControls>
)
