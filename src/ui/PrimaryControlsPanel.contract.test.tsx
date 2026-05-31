import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrimaryControlsPanel } from './PrimaryControlsPanel'
import type { PrimaryControlsPanelProps } from './primaryControlsPanelTypes'
import type { SegmentListItem } from './segmentListTypes'

const suggestion = {
  id: 'seg-1',
  name: 'Civic West',
  tier: 'GREEN',
  allowedNow: 'PARK',
  reasonCodes: [],
  reasons: [],
  source: 'OFFICIAL_RULE',
  sourceType: 'CURB',
  distanceMeters: 120,
  parkingSpaceCount: 4,
} as unknown as SegmentListItem

const baseProps: PrimaryControlsPanelProps = {
  activeView: 'MAP',
  onActiveViewChange: () => {},
  onMapPrefetch: () => {},
  datasetId: 'xinyi',
  datasetOptions: [
    { id: 'xinyi', label: 'Xinyi' },
    { id: 'daan', label: 'Daan' },
  ],
  onDatasetIdChange: () => {},
  filterInputRef: createRef<HTMLInputElement>(),
  filterQuery: 'civic',
  onFilterQueryChange: () => {},
  onFilterInputKeyDown: () => {},
  segmentFilterSuggestions: [suggestion],
  selectedId: 'seg-1',
  onSegmentSuggestionKeyDown: () => {},
  onSelectSegmentSuggestion: () => {},
  registerSegmentSuggestionRef: () => {},
  formatDistanceMeters: (value) => `${value ?? 0} m`,
  formatParkingSpaceCount: (value) =>
    typeof value === 'number' && value > 0 ? `${value} spaces` : null,
  filteredSegmentCount: 2,
  totalSegmentCount: 18,
  hasActiveFilters: true,
  activeFilterChips: [
    { key: 'text', label: 'Text: civic' },
    { key: 'spaces', label: 'Spaces only' },
  ],
  onResetViewFilters: () => {},
  onClearActiveFilter: () => {},
}

describe('PrimaryControlsPanel contract', () => {
  it('renders view, dataset, segment search, and active filters', () => {
    const html = renderToStaticMarkup(<PrimaryControlsPanel {...baseProps} />)

    expect(html).toContain('View')
    expect(html).toContain('Map + list')
    expect(html).toContain('Dataset')
    expect(html).toContain('Active: xinyi')
    expect(html).toContain('Filter segments')
    expect(html).toContain('Civic West')
    expect(html).toContain('Matches: 2 / 18')
    expect(html).toContain('Enter selects the best match.')
    expect(html).toContain('Active filters')
    expect(html).toContain('Reset filters')
    expect(html).toContain('Text: civic')
    expect(html).toContain('Spaces only')
  })
})
