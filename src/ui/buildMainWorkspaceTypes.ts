import type { MainWorkspaceProps } from './appPresentationBuilderTypes'

export interface BuildMainWorkspacePropsOptions {
  activeView: MainWorkspaceProps['activeView']
  datasetStatus: MainWorkspaceProps['datasetStatus']
  mapViewComponent: MainWorkspaceProps['mapViewComponent']
  mapRetryKey: MainWorkspaceProps['mapRetryKey']
  onMapRetry: MainWorkspaceProps['onMapRetry']
  center: MainWorkspaceProps['mapViewProps']['center']
  segments: MainWorkspaceProps['mapViewProps']['segments']
  zones: MainWorkspaceProps['mapViewProps']['zones']
  intersectionZones: MainWorkspaceProps['mapViewProps']['intersectionZones']
  showZones: MainWorkspaceProps['mapViewProps']['showZones']
  showIntersectionZones: MainWorkspaceProps['mapViewProps']['showIntersectionZones']
  crosswalkZones: MainWorkspaceProps['mapViewProps']['crosswalkZones']
  showCrosswalkZones: MainWorkspaceProps['mapViewProps']['showCrosswalkZones']
  parkingSpaces: MainWorkspaceProps['mapViewProps']['parkingSpaces']
  showParkingSpaces: MainWorkspaceProps['mapViewProps']['showParkingSpaces']
  showInferredCandidates: MainWorkspaceProps['mapViewProps']['showInferredCandidates']
  selectedId: MainWorkspaceProps['mapViewProps']['selectedId']
  districtBounds: MainWorkspaceProps['mapViewProps']['districtBounds']
  districtBoundsKey: MainWorkspaceProps['mapViewProps']['districtBoundsKey']
  activeFocusBounds: {
    bounds: NonNullable<MainWorkspaceProps['mapViewProps']['focusBounds']>
    key: NonNullable<MainWorkspaceProps['mapViewProps']['focusBoundsKey']>
  } | null
  activeFocusCenter: {
    center: NonNullable<MainWorkspaceProps['mapViewProps']['focusCenter']>
    key: NonNullable<MainWorkspaceProps['mapViewProps']['focusCenterKey']>
  } | null
  recommendedSegmentIds: MainWorkspaceProps['mapViewProps']['recommendedSegmentIds']
  searchLocation: MainWorkspaceProps['mapViewProps']['searchLocation']
  searchLocationLabel: MainWorkspaceProps['mapViewProps']['searchLocationLabel']
  coverageBoundary: MainWorkspaceProps['mapViewProps']['coverageBoundary']
  selectedCenter: MainWorkspaceProps['mapViewProps']['arrivalLocation']
  selectedArrivalKind: MainWorkspaceProps['selectedArrivalKind']
  selectedArrivalLabel: string | null
  recommendedParkingTargetMarkers: MainWorkspaceProps['mapViewProps']['recommendedParkingTargetMarkers']
  selectedParkingSpaceMarkers: MainWorkspaceProps['mapViewProps']['selectedParkingSpaceMarkers']
  selectedRouteProfile: MainWorkspaceProps['selectedRouteProfile']
  selectedRoutePath: {
    geometry: MainWorkspaceProps['mapViewProps']['routeGeometry']
  } | null
  selectedRouteProfileLabel: MainWorkspaceProps['selectedRouteProfileLabel']
  userLocation: MainWorkspaceProps['mapViewProps']['userLocation']
  onSelectMapSegment: MainWorkspaceProps['mapViewProps']['onSelect']
  onSelectRecommendedTarget: MainWorkspaceProps['mapViewProps']['onSelectRecommendedTarget']
  onSelectParkingSpace: MainWorkspaceProps['mapViewProps']['onSelectParkingSpace']
  onPickMapLocation: MainWorkspaceProps['mapViewProps']['onPickLocation']
  searchAnchor: unknown
  parkingSpaceCount: MainWorkspaceProps['parkingSpaceCount']
  displaySegments: MainWorkspaceProps['listProps']['segments']
  displaySegmentTotalCount: NonNullable<MainWorkspaceProps['listProps']['totalCount']>
  displaySegmentLimit: NonNullable<MainWorkspaceProps['listProps']['displayLimit']>
  onSelectListSegment: MainWorkspaceProps['listProps']['onSelect']
  onNavigateFromListSegment: MainWorkspaceProps['listProps']['onNavigate']
  onSaveListSegment: MainWorkspaceProps['listProps']['onSave']
  reportsBySegment: MainWorkspaceProps['listProps']['reports']
  emptySegmentsMessage: MainWorkspaceProps['listProps']['emptyMessage']
  listSortSummary: MainWorkspaceProps['listProps']['sortSummary']
  hasActiveFilters: boolean
  onResetViewFilters: NonNullable<MainWorkspaceProps['listProps']['onEmptyAction']>
}
