import type { TripBoardSortMode } from './savedPlanTypes'

interface TripBoardControlsHeadingProps {
  tripBoardSortMode: TripBoardSortMode
  tripBoardSortModeLabels: Record<TripBoardSortMode, string>
}

export const TripBoardControlsHeading = ({
  tripBoardSortMode,
  tripBoardSortModeLabels,
}: TripBoardControlsHeadingProps) => (
  <div className="address-recommendations-heading">
    <div className="control-label">Trip board</div>
    <div className="control-meta">
      Save, import, rename, and reopen parking plans without leaving the app.
    </div>
    <div className="control-meta">
      Pinned plans stay first. Sort mode: {tripBoardSortModeLabels[tripBoardSortMode]}.
    </div>
  </div>
)
