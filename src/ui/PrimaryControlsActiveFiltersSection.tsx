import type { PrimaryControlsPanelProps } from './primaryControlsPanelTypes'

type PrimaryControlsActiveFiltersSectionProps = Pick<
  PrimaryControlsPanelProps,
  | 'hasActiveFilters'
  | 'activeFilterChips'
  | 'onResetViewFilters'
  | 'onClearActiveFilter'
>

export function PrimaryControlsActiveFiltersSection({
  hasActiveFilters,
  activeFilterChips,
  onResetViewFilters,
  onClearActiveFilter,
}: PrimaryControlsActiveFiltersSectionProps) {
  if (!hasActiveFilters) {
    return null
  }

  return (
    <div className="control-group control-group-active-filters">
      <div className="active-filters-header">
        <div>
          <div className="control-label">Active filters</div>
          <div className="control-meta">
            {activeFilterChips.length} active filter
            {activeFilterChips.length === 1 ? '' : 's'} shaping search, list, and
            recommendations.
          </div>
        </div>
        <button
          type="button"
          className="active-filter-reset"
          onClick={onResetViewFilters}
        >
          Reset filters
        </button>
      </div>
      <div className="active-filter-chip-list">
        {activeFilterChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="active-filter-chip"
            onClick={() => onClearActiveFilter(chip.key)}
          >
            <span>{chip.label}</span>
            <span aria-hidden="true">x</span>
          </button>
        ))}
      </div>
    </div>
  )
}
