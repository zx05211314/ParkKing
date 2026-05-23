import { SegmentListRow } from './SegmentListRow'
import type { SegmentListProps } from './segmentListTypes'

export const SegmentList = ({
  segments,
  totalCount = segments.length,
  displayLimit = segments.length,
  selectedId,
  onSelect,
  onNavigate = null,
  onSave = null,
  reports,
  emptyMessage,
  sortSummary = null,
  emptyActionLabel = null,
  onEmptyAction = null,
}: SegmentListProps) => {
  const isLimited = totalCount > segments.length
  const countLabel = isLimited
    ? `${segments.length} shown of ${totalCount} total`
    : `${segments.length} total`

  return (
    <div className="segment-list">
      <div className="segment-list-header">
        <div>
          <h2>Nearby segments</h2>
          {sortSummary ? <div className="segment-list-summary">{sortSummary}</div> : null}
        </div>
        <span>{countLabel}</span>
      </div>
      {isLimited ? (
        <div className="segment-list-summary">
          Showing first {displayLimit} results. Use a map pin, search, or filters to narrow.
        </div>
      ) : null}
      {segments.length === 0 ? (
        <div className="segment-list-empty">
          <div>{emptyMessage ?? 'No segments available.'}</div>
          {emptyActionLabel && onEmptyAction ? (
            <button
              type="button"
              className="address-recommendations-action"
              onClick={onEmptyAction}
            >
              {emptyActionLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="segment-list-items">
          {segments.map((segment) => (
            <SegmentListRow
              key={segment.id}
              segment={segment}
              selectedId={selectedId}
              onSelect={onSelect}
              onNavigate={onNavigate}
              onSave={onSave}
              reports={reports}
            />
          ))}
        </div>
      )}
    </div>
  )
}
