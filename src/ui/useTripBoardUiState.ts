import { useSavedPlansUiState } from './useSavedPlansUiState'
import { useTripBoardFilterUiState } from './useTripBoardFilterUiState'
import type { TripBoardSortMode } from './savedPlanTypes'

interface UseTripBoardUiStateOptions {
  defaultTripBoardSortMode: TripBoardSortMode
}

export const useTripBoardUiState = ({
  defaultTripBoardSortMode,
}: UseTripBoardUiStateOptions) => ({
  ...useSavedPlansUiState(),
  ...useTripBoardFilterUiState({
    defaultTripBoardSortMode,
  }),
})
