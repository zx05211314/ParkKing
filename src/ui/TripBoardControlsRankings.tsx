import {
  type SavedPlanIntent,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionFilter,
  type SavedPlanIntentSuggestionFilterSummary,
  type SavedPlanIntentSummary,
  type TripBoardSortMode,
} from './savedPlanTypes'

interface TripBoardControlsRankingsProps {
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
}

export const TripBoardControlsRankings = ({
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
}: TripBoardControlsRankingsProps) => (
  <>
    <div className="address-recommendation-ranking">
      <div className="control-label">Sort by</div>
      <div className="segmented segmented-compact">
        {(Object.entries(tripBoardSortModeLabels) as Array<[TripBoardSortMode, string]>).map(
          ([modeKey, label]) => (
            <button
              key={modeKey}
              type="button"
              className={tripBoardSortMode === modeKey ? 'active' : ''}
              onClick={() => onTripBoardSortModeChange(modeKey)}
            >
              {label}
            </button>
          ),
        )}
      </div>
    </div>
    <div className="address-recommendation-ranking">
      <div className="control-label">Intent</div>
      <div className="segmented segmented-compact">
        <button
          type="button"
          className={tripBoardIntentFilter === 'ALL' ? 'active' : ''}
          onClick={() => onSetTripBoardIntentFilter('ALL')}
        >
          {tripBoardIntentFilterLabels.ALL}
        </button>
        {savedPlanIntents.map((intent) => (
          <button
            key={intent}
            type="button"
            className={tripBoardIntentFilter === intent ? 'active' : ''}
            onClick={() => onSetTripBoardIntentFilter(intent)}
          >
            {tripBoardIntentFilterLabels[intent]}
          </button>
        ))}
        <button
          type="button"
          className={tripBoardIntentFilter === 'UNTAGGED' ? 'active' : ''}
          onClick={() => onSetTripBoardIntentFilter('UNTAGGED')}
        >
          {tripBoardIntentFilterLabels.UNTAGGED}
        </button>
      </div>
    </div>
    {tripBoardIntentFilter === 'UNTAGGED' ||
    visibleSavedPlanIntentSummary.unassignedCount > 0 ? (
      <div className="address-recommendation-ranking">
        <div className="control-label">Review</div>
        <div className="segmented segmented-compact">
          {(
            Object.entries(tripBoardSuggestionFilterLabels) as Array<
              [SavedPlanIntentSuggestionFilter, string]
            >
          ).map(([filterKey, label]) => (
            <button
              key={filterKey}
              type="button"
              className={tripBoardSuggestionFilter === filterKey ? 'active' : ''}
              onClick={() => onSetTripBoardSuggestionFilter(filterKey)}
            >
              {label} ({tripBoardSuggestionFilterSummary[filterKey]})
            </button>
          ))}
        </div>
      </div>
    ) : null}
  </>
)
