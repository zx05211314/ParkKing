import type { ChangeEvent, ReactNode, RefObject } from 'react'
import type { TripBoardFilters } from './savedPlanTypes'

interface TripBoardControlsFooterProps {
  savedPlansCount: number
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

export const TripBoardControlsFooter = ({
  savedPlansCount,
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
}: TripBoardControlsFooterProps) => (
  <>
    <input
      ref={savedPlanImportRef}
      type="file"
      accept="application/json"
      className="hidden-file-input"
      onChange={onImportSavedPlans}
    />
    {children}
    {savedPlansCount > 0 ? (
      <div className="control-input saved-plan-search">
        <input
          type="text"
          value={tripBoardQuery}
          onChange={(event) => onTripBoardQueryChange(event.target.value)}
          placeholder="Search saved plans"
          aria-label="Search saved plans"
        />
      </div>
    ) : null}
    {savedPlansCount > 0 ? (
      <div className="saved-plan-filter-bar">
        {(Object.entries(tripBoardFilterLabels) as Array<[keyof TripBoardFilters, string]>).map(
          ([filterKey, label]) => (
            <button
              key={filterKey}
              type="button"
              className={
                tripBoardFilters[filterKey]
                  ? 'address-recommendations-action active'
                  : 'address-recommendations-action'
              }
              onClick={() => onToggleTripBoardFilter(filterKey)}
            >
              {label}
            </button>
          ),
        )}
        {hasActiveTripBoardFilters ? (
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onResetTripBoardFilters}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    ) : null}
  </>
)
