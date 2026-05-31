import type { HeaderPanelsProps } from './appPresentationBuilderTypes'

export type PrimaryControlsProps = HeaderPanelsProps['primaryControlsProps']

export interface BuildPrimaryControlsPropsOptions {
  activeView: PrimaryControlsProps['activeView']
  onActiveViewChange: PrimaryControlsProps['onActiveViewChange']
  onMapPrefetch: PrimaryControlsProps['onMapPrefetch']
  datasetId: HeaderPanelsProps['datasetId']
  datasetOptions: PrimaryControlsProps['datasetOptions']
  onDatasetIdChange: PrimaryControlsProps['onDatasetIdChange']
  filterInputRef: PrimaryControlsProps['filterInputRef']
  filterQuery: PrimaryControlsProps['filterQuery']
  onFilterQueryChange: PrimaryControlsProps['onFilterQueryChange']
  onFilterInputKeyDown: PrimaryControlsProps['onFilterInputKeyDown']
  segmentFilterSuggestions: PrimaryControlsProps['segmentFilterSuggestions']
  selectedId: PrimaryControlsProps['selectedId']
  onSegmentSuggestionKeyDown: PrimaryControlsProps['onSegmentSuggestionKeyDown']
  onSelectSegmentSuggestion: PrimaryControlsProps['onSelectSegmentSuggestion']
  registerSegmentSuggestionRef: PrimaryControlsProps['registerSegmentSuggestionRef']
  filteredSegmentCount: PrimaryControlsProps['filteredSegmentCount']
  totalSegmentCount: PrimaryControlsProps['totalSegmentCount']
  hasActiveFilters: PrimaryControlsProps['hasActiveFilters']
  activeFilterChips: PrimaryControlsProps['activeFilterChips']
  onResetViewFilters: PrimaryControlsProps['onResetViewFilters']
  onClearActiveFilter: PrimaryControlsProps['onClearActiveFilter']
}
