import type { PrimaryControlsPanelProps } from './primaryControlsPanelTypes'

type PrimaryControlsSegmentFilterSectionProps = Pick<
  PrimaryControlsPanelProps,
  | 'filterInputRef'
  | 'filterQuery'
  | 'onFilterQueryChange'
  | 'onFilterInputKeyDown'
  | 'segmentFilterSuggestions'
  | 'selectedId'
  | 'onSegmentSuggestionKeyDown'
  | 'onSelectSegmentSuggestion'
  | 'registerSegmentSuggestionRef'
  | 'formatDistanceMeters'
  | 'formatParkingSpaceCount'
  | 'filteredSegmentCount'
  | 'totalSegmentCount'
>

export function PrimaryControlsSegmentFilterSection({
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
}: PrimaryControlsSegmentFilterSectionProps) {
  return (
    <div className="control-group">
      <div className="control-label">Filter segments</div>
      <div className="search-form">
        <div className="control-input">
          <input
            ref={filterInputRef}
            type="search"
            value={filterQuery}
            placeholder="Road or segment"
            onChange={(event) => onFilterQueryChange(event.target.value)}
            onKeyDown={onFilterInputKeyDown}
          />
        </div>
        {filterQuery.trim().length > 0 ? (
          <div className="search-actions">
            <button
              type="button"
              className="sheet-close"
              onClick={() => onFilterQueryChange('')}
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>
      {segmentFilterSuggestions.length > 0 ? (
        <div className="segment-filter-suggestions">
          {segmentFilterSuggestions.map((segment, index) => {
            const parkingSpaceLabel = formatParkingSpaceCount(segment.parkingSpaceCount)

            return (
              <button
                key={segment.id}
                ref={(element) => {
                  registerSegmentSuggestionRef(index, element)
                }}
                type="button"
                className={
                  segment.id === selectedId
                    ? 'segment-filter-suggestion active'
                    : 'segment-filter-suggestion'
                }
                onKeyDown={(event) => onSegmentSuggestionKeyDown(event, index)}
                onClick={() => onSelectSegmentSuggestion(segment)}
              >
                <div className="segment-filter-suggestion-title">{segment.name}</div>
                <div className="segment-filter-suggestion-meta">
                  <span>{segment.tier}</span>
                  <span>{segment.allowedNow.replace('_', ' ')}</span>
                  {segment.sourceType === 'INFERRED' ? <span>Inferred</span> : null}
                  {segment.distanceMeters !== undefined ? (
                    <span>{formatDistanceMeters(segment.distanceMeters)}</span>
                  ) : null}
                  {parkingSpaceLabel ? <span>{parkingSpaceLabel}</span> : null}
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="control-meta">
        Matches: {filteredSegmentCount} / {totalSegmentCount}
      </div>
      {segmentFilterSuggestions.length > 0 ? (
        <div className="control-meta">
          Enter selects the best match. Arrow keys move through suggestions.
        </div>
      ) : null}
    </div>
  )
}
