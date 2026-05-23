import type { SharedAppState } from './sharedAppStateTypes'
import type { AppDerivedStateOptions } from './appDerivedStateTypes'

export const buildSharedAppState = ({
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
  selectedParkingShareKey,
  selectedRouteProfile,
}: Pick<
  AppDerivedStateOptions,
  | 'actionFilter'
  | 'activeView'
  | 'datasetId'
  | 'filterQuery'
  | 'hideReportedIllegal'
  | 'includeInferred'
  | 'markedSpacesOnly'
  | 'mode'
  | 'radiusMeters'
  | 'recommendationRankMode'
  | 'riskMode'
  | 'searchAnchor'
  | 'selectedId'
  | 'selectedRouteProfile'
> & {
  selectedParkingShareKey: string | null
}): SharedAppState => ({
  datasetId,
  filterQuery,
  searchResult: searchAnchor?.result ?? null,
  selectedId,
  selectedParkingSpaceKey: selectedParkingShareKey,
  recommendationRankMode,
  routeProfile: selectedRouteProfile,
  riskMode,
  mode,
  radiusMeters,
  actionFilter,
  markedSpacesOnly,
  hideReportedIllegal,
  includeInferred,
  activeView,
})

export const hasShareableAppState = ({
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
}: Pick<
  AppDerivedStateOptions,
  | 'actionFilter'
  | 'activeView'
  | 'defaultRadiusMeters'
  | 'defaultRecommendationRankMode'
  | 'defaultRiskMode'
  | 'defaultRouteProfile'
  | 'defaultSegmentActionFilter'
  | 'filterQuery'
  | 'hideReportedIllegal'
  | 'includeInferred'
  | 'markedSpacesOnly'
  | 'mode'
  | 'radiusMeters'
  | 'recommendationRankMode'
  | 'riskMode'
  | 'searchAnchor'
  | 'selectedId'
  | 'selectedRouteProfile'
>) =>
  Boolean(
    filterQuery.trim().length > 0 ||
      searchAnchor ||
      selectedId ||
      actionFilter !== defaultSegmentActionFilter ||
      markedSpacesOnly ||
      hideReportedIllegal ||
      includeInferred ||
      recommendationRankMode !== defaultRecommendationRankMode ||
      selectedRouteProfile !== defaultRouteProfile ||
      radiusMeters !== defaultRadiusMeters ||
      riskMode !== defaultRiskMode ||
      mode !== 'NOW' ||
      activeView === 'MAP',
  )
