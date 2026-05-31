import type { KeyboardEvent, RefObject } from 'react'
import type { ActiveFilterChip } from './recommendationDisplayFilters'
import type { SegmentListItem } from './segmentListTypes'

export interface DatasetOption {
  id: string
  label: string
}

export interface PrimaryControlsPanelProps {
  activeView: 'LIST' | 'MAP'
  onActiveViewChange: (view: 'LIST' | 'MAP') => void
  onMapPrefetch: () => void
  datasetId: string | null
  datasetOptions: DatasetOption[]
  onDatasetIdChange: (datasetId: string | null) => void
  filterInputRef: RefObject<HTMLInputElement | null>
  filterQuery: string
  onFilterQueryChange: (value: string) => void
  onFilterInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  segmentFilterSuggestions: SegmentListItem[]
  selectedId: string | null
  onSegmentSuggestionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
  onSelectSegmentSuggestion: (segment: SegmentListItem) => void
  registerSegmentSuggestionRef: (
    index: number,
    element: HTMLButtonElement | null,
  ) => void
  formatDistanceMeters: (value?: number) => string
  formatParkingSpaceCount: (value?: number | null) => string | null
  filteredSegmentCount: number
  totalSegmentCount: number
  hasActiveFilters: boolean
  activeFilterChips: ActiveFilterChip[]
  onResetViewFilters: () => void
  onClearActiveFilter: (key: string) => void
}
