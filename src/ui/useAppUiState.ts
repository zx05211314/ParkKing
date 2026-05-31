import { useAppControlUiState } from './useAppControlUiState'
import { useAppDatasetUiState } from './useAppDatasetUiState'
import { useAppRouteUiState } from './useAppRouteUiState'
import { useAppSearchUiState } from './useAppSearchUiState'
import type { UseAppUiStateOptions } from './appUiStateTypes'

export const useAppUiState = ({
  fallbackDatasetOptions,
  initialSharedState,
  defaultRadiusMeters,
  defaultRiskMode,
  defaultRecommendationRankMode,
  defaultRouteProfile,
  defaultSegmentActionFilter,
}: UseAppUiStateOptions) => ({
  ...useAppControlUiState({
    fallbackDatasetOptions,
    initialSharedState,
    defaultRadiusMeters,
    defaultRiskMode,
    defaultSegmentActionFilter,
  }),
  ...useAppSearchUiState({
    initialSharedState,
  }),
  ...useAppRouteUiState({
    initialSharedState,
    defaultRecommendationRankMode,
    defaultRouteProfile,
  }),
  ...useAppDatasetUiState(),
})
