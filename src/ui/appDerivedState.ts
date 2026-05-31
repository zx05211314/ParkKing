import { ROUTE_PROFILE_LABELS } from './appPresentationLabels'
import { buildAppDerivedDatasetState } from './appDerivedDatasetState'
import { buildAppDerivedNavigationState } from './appDerivedNavigationState'
import {
  buildSharedAppState,
  hasShareableAppState,
} from './appDerivedShareState'
import type {
  AppDerivedStateOptions,
  AppDerivedStateResult,
} from './appDerivedStateTypes'

export type {
  AppDerivedStateOptions,
  AppDerivedStateResult,
  DatasetOption,
  SearchAnchorLike,
} from './appDerivedStateTypes'
export { buildSharedAppState, hasShareableAppState } from './appDerivedShareState'

export const buildAppDerivedState = ({
  actionFilter,
  activeView,
  datasetId,
  datasetMeta,
  datasetOptions,
  defaultRadiusMeters,
  defaultRecommendationRankMode,
  defaultRiskMode,
  defaultRouteProfile,
  defaultSegmentActionFilter,
  filterQuery,
  hideReportedIllegal,
  includeInferred,
  locationLabel,
  markedSpacesOnly,
  mode,
  radiusMeters,
  recommendationRankMode,
  riskMode,
  searchAnchor,
  selectedId,
  selectedParkingSpaceKeyBySegment,
  selectedRouteProfile,
  userLocation,
}: AppDerivedStateOptions): AppDerivedStateResult => {
  const datasetState = buildAppDerivedDatasetState({
    datasetId,
    datasetMeta,
    datasetOptions,
  })
  const navigationState = buildAppDerivedNavigationState({
    locationLabel,
    searchAnchor,
    selectedId,
    selectedParkingSpaceKeyBySegment,
    userLocation,
  })
  const sharedAppState = buildSharedAppState({
    actionFilter,
    activeView,
    datasetId,
    filterQuery,
    hideReportedIllegal,
    includeInferred,
    markedSpacesOnly,
    mode,
    radiusMeters,
    recommendationRankMode,
    riskMode,
    searchAnchor,
    selectedId,
    selectedParkingShareKey: navigationState.selectedParkingShareKey,
    selectedRouteProfile,
  })

  return {
    ...datasetState,
    ...navigationState,
    hasShareableState: hasShareableAppState({
      actionFilter,
      activeView,
      defaultRadiusMeters,
      defaultRecommendationRankMode,
      defaultRiskMode,
      defaultRouteProfile,
      defaultSegmentActionFilter,
      filterQuery,
      hideReportedIllegal,
      includeInferred,
      markedSpacesOnly,
      mode,
      radiusMeters,
      recommendationRankMode,
      riskMode,
      searchAnchor,
      selectedId,
      selectedRouteProfile,
    }),
    selectedRouteProfileLabel: ROUTE_PROFILE_LABELS[selectedRouteProfile],
    sharedAppState,
  }
}
