import { PrimaryControlsActiveFiltersSection } from './PrimaryControlsActiveFiltersSection'
import { PrimaryControlsDatasetSection } from './PrimaryControlsDatasetSection'
import { PrimaryControlsSegmentFilterSection } from './PrimaryControlsSegmentFilterSection'
import { PrimaryControlsViewSection } from './PrimaryControlsViewSection'
import type { PrimaryControlsPanelProps } from './primaryControlsPanelTypes'

export const PrimaryControlsPanel = ({
  activeView,
  onActiveViewChange,
  onMapPrefetch,
  datasetId,
  datasetOptions,
  onDatasetIdChange,
  filterInputRef,
  filterQuery,
  onFilterQueryChange,
  onFilterInputKeyDown,
  segmentFilterSuggestions,
  selectedId,
  onSegmentSuggestionKeyDown,
  onSelectSegmentSuggestion,
  registerSegmentSuggestionRef,
  formatDistanceMeters,
  formatParkingSpaceCount,
  filteredSegmentCount,
  totalSegmentCount,
  hasActiveFilters,
  activeFilterChips,
  onResetViewFilters,
  onClearActiveFilter,
}: PrimaryControlsPanelProps) => (
  <>
    <PrimaryControlsViewSection
      activeView={activeView}
      onActiveViewChange={onActiveViewChange}
      onMapPrefetch={onMapPrefetch}
    />
    <PrimaryControlsDatasetSection
      datasetId={datasetId}
      datasetOptions={datasetOptions}
      onDatasetIdChange={onDatasetIdChange}
    />
    <PrimaryControlsSegmentFilterSection
      filterInputRef={filterInputRef}
      filterQuery={filterQuery}
      onFilterQueryChange={onFilterQueryChange}
      onFilterInputKeyDown={onFilterInputKeyDown}
      segmentFilterSuggestions={segmentFilterSuggestions}
      selectedId={selectedId}
      onSegmentSuggestionKeyDown={onSegmentSuggestionKeyDown}
      onSelectSegmentSuggestion={onSelectSegmentSuggestion}
      registerSegmentSuggestionRef={registerSegmentSuggestionRef}
      formatDistanceMeters={formatDistanceMeters}
      formatParkingSpaceCount={formatParkingSpaceCount}
      filteredSegmentCount={filteredSegmentCount}
      totalSegmentCount={totalSegmentCount}
    />
    <PrimaryControlsActiveFiltersSection
      hasActiveFilters={hasActiveFilters}
      activeFilterChips={activeFilterChips}
      onResetViewFilters={onResetViewFilters}
      onClearActiveFilter={onClearActiveFilter}
    />
  </>
)
