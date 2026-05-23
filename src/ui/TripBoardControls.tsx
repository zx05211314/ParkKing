import type { ChangeEvent, ReactNode, RefObject } from 'react'
import {
  type SavedPlanIntent,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionFilter,
  type SavedPlanIntentSuggestionFilterSummary,
  type SavedPlanIntentSummary,
  type TripBoardFilters,
  type TripBoardSortMode,
} from './savedPlanTypes'
import { TripBoardControlsActionBar } from './TripBoardControlsActionBar'
import { TripBoardControlsFooter } from './TripBoardControlsFooter'
import { TripBoardControlsHeading } from './TripBoardControlsHeading'
import { TripBoardControlsRankings } from './TripBoardControlsRankings'

interface TripBoardControlsProps {
  savedPlansCount: number
  tripBoardSortMode: TripBoardSortMode
  tripBoardSortModeLabels: Record<TripBoardSortMode, string>
  onTripBoardSortModeChange: (mode: TripBoardSortMode) => void
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardIntentFilterLabels: Record<SavedPlanIntentFilter, string>
  savedPlanIntents: SavedPlanIntent[]
  onSetTripBoardIntentFilter: (intent: SavedPlanIntentFilter) => void
  visibleSavedPlanIntentSummary: SavedPlanIntentSummary
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardSuggestionFilterLabels: Record<SavedPlanIntentSuggestionFilter, string>
  tripBoardSuggestionFilterSummary: SavedPlanIntentSuggestionFilterSummary
  onSetTripBoardSuggestionFilter: (filter: SavedPlanIntentSuggestionFilter) => void
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
  savedPlanImportRef: RefObject<HTMLInputElement | null>
  onImportSavedPlans: (event: ChangeEvent<HTMLInputElement>) => void
  children?: ReactNode
  tripBoardQuery: string
  onTripBoardQueryChange: (value: string) => void
  tripBoardFilterLabels: Record<keyof TripBoardFilters, string>
  tripBoardFilters: TripBoardFilters
  onToggleTripBoardFilter: (filterKey: keyof TripBoardFilters) => void
  hasActiveTripBoardFilters: boolean
  onResetTripBoardFilters: () => void
}

export const TripBoardControls = ({
  savedPlansCount,
  tripBoardSortMode,
  tripBoardSortModeLabels,
  onTripBoardSortModeChange,
  tripBoardIntentFilter,
  tripBoardIntentFilterLabels,
  savedPlanIntents,
  onSetTripBoardIntentFilter,
  visibleSavedPlanIntentSummary,
  tripBoardSuggestionFilter,
  tripBoardSuggestionFilterLabels,
  tripBoardSuggestionFilterSummary,
  onSetTripBoardSuggestionFilter,
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
  savedPlanImportRef,
  onImportSavedPlans,
  children,
  tripBoardQuery,
  onTripBoardQueryChange,
  tripBoardFilterLabels,
  tripBoardFilters,
  onToggleTripBoardFilter,
  hasActiveTripBoardFilters,
  onResetTripBoardFilters,
}: TripBoardControlsProps) => (
  <>
    <div className="address-recommendations-header">
      <TripBoardControlsHeading
        tripBoardSortMode={tripBoardSortMode}
        tripBoardSortModeLabels={tripBoardSortModeLabels}
      />
      <TripBoardControlsRankings
        tripBoardSortMode={tripBoardSortMode}
        tripBoardSortModeLabels={tripBoardSortModeLabels}
        onTripBoardSortModeChange={onTripBoardSortModeChange}
        tripBoardIntentFilter={tripBoardIntentFilter}
        tripBoardIntentFilterLabels={tripBoardIntentFilterLabels}
        savedPlanIntents={savedPlanIntents}
        onSetTripBoardIntentFilter={onSetTripBoardIntentFilter}
        visibleSavedPlanIntentSummary={visibleSavedPlanIntentSummary}
        tripBoardSuggestionFilter={tripBoardSuggestionFilter}
        tripBoardSuggestionFilterLabels={tripBoardSuggestionFilterLabels}
        tripBoardSuggestionFilterSummary={tripBoardSuggestionFilterSummary}
        onSetTripBoardSuggestionFilter={onSetTripBoardSuggestionFilter}
      />
      <TripBoardControlsActionBar
        savedPlansCount={savedPlansCount}
        hasTopVisibleSavedPlan={hasTopVisibleSavedPlan}
        onOpenTopSavedPlan={onOpenTopSavedPlan}
        onCopyTopSavedPlanLink={onCopyTopSavedPlanLink}
        compareBoardActionLabel={compareBoardActionLabel}
        compareBoardSelectionLength={compareBoardSelectionLength}
        onApplyVisibleSavedPlansToCompare={onApplyVisibleSavedPlansToCompare}
        canPinTopSavedPlan={canPinTopSavedPlan}
        onPinTopSavedPlan={onPinTopSavedPlan}
        onTriggerSavedPlanImport={onTriggerSavedPlanImport}
        onExportSavedPlans={onExportSavedPlans}
        hasExpandedVisibleSavedPlanGroups={hasExpandedVisibleSavedPlanGroups}
        hasCollapsedVisibleSavedPlanGroups={hasCollapsedVisibleSavedPlanGroups}
        onCollapseAllSavedPlanGroups={onCollapseAllSavedPlanGroups}
        onExpandAllSavedPlanGroups={onExpandAllSavedPlanGroups}
        onClearSavedPlans={onClearSavedPlans}
      />
    </div>
    <TripBoardControlsFooter
      savedPlansCount={savedPlansCount}
      savedPlanImportRef={savedPlanImportRef}
      onImportSavedPlans={onImportSavedPlans}
      tripBoardQuery={tripBoardQuery}
      onTripBoardQueryChange={onTripBoardQueryChange}
      tripBoardFilterLabels={tripBoardFilterLabels}
      tripBoardFilters={tripBoardFilters}
      onToggleTripBoardFilter={onToggleTripBoardFilter}
      hasActiveTripBoardFilters={hasActiveTripBoardFilters}
      onResetTripBoardFilters={onResetTripBoardFilters}
    >
      {children}
    </TripBoardControlsFooter>
  </>
)
