import type { HeaderPanelsProps } from './appPresentationBuilderTypes'

export type RuntimeSettingsPanelProps = HeaderPanelsProps['runtimeSettingsPanelProps']
export type DatasetStatusPanelProps = HeaderPanelsProps['datasetStatusPanelProps']

export interface BuildHeaderStatusPanelsPropsOptions {
  mode: RuntimeSettingsPanelProps['mode']
  nowHHMM: RuntimeSettingsPanelProps['nowHHMM']
  onModeChange: RuntimeSettingsPanelProps['onModeChange']
  useMockLocation: RuntimeSettingsPanelProps['useMockLocation']
  onUseMockLocationChange: RuntimeSettingsPanelProps['onUseMockLocationChange']
  locationLabel: RuntimeSettingsPanelProps['locationLabel']
  radiusMeters: RuntimeSettingsPanelProps['radiusMeters']
  onRadiusChange: RuntimeSettingsPanelProps['onRadiusChange']
  riskMode: RuntimeSettingsPanelProps['riskMode']
  onRiskModeChange: RuntimeSettingsPanelProps['onRiskModeChange']
  showZones: RuntimeSettingsPanelProps['showZones']
  onShowZonesChange: RuntimeSettingsPanelProps['onShowZonesChange']
  showIntersectionZones: RuntimeSettingsPanelProps['showIntersectionZones']
  onShowIntersectionZonesChange: RuntimeSettingsPanelProps['onShowIntersectionZonesChange']
  showCrosswalkZones: RuntimeSettingsPanelProps['showCrosswalkZones']
  onShowCrosswalkZonesChange: RuntimeSettingsPanelProps['onShowCrosswalkZonesChange']
  showParkingSpaces: RuntimeSettingsPanelProps['showParkingSpaces']
  onShowParkingSpacesChange: RuntimeSettingsPanelProps['onShowParkingSpacesChange']
  parkingSpaceCount: RuntimeSettingsPanelProps['parkingSpaceCount']
  actionFilteredMarkedSpaceSegmentCount: RuntimeSettingsPanelProps['actionFilteredMarkedSpaceSegmentCount']
  markedSpacesOnly: RuntimeSettingsPanelProps['markedSpacesOnly']
  onMarkedSpacesOnlyChange: RuntimeSettingsPanelProps['onMarkedSpacesOnlyChange']
  actionFilter: RuntimeSettingsPanelProps['actionFilter']
  actionFilterHiddenCount: RuntimeSettingsPanelProps['actionFilterHiddenCount']
  onActionFilterChange: RuntimeSettingsPanelProps['onActionFilterChange']
  hideReportedIllegal: RuntimeSettingsPanelProps['hideReportedIllegal']
  illegalFeedbackHiddenCount: RuntimeSettingsPanelProps['illegalFeedbackHiddenCount']
  onHideReportedIllegalChange: RuntimeSettingsPanelProps['onHideReportedIllegalChange']
  showInferredCandidates: RuntimeSettingsPanelProps['showInferredCandidates']
  onShowInferredCandidatesChange: RuntimeSettingsPanelProps['onShowInferredCandidatesChange']
  includeInferred: RuntimeSettingsPanelProps['includeInferred']
  onIncludeInferredChange: RuntimeSettingsPanelProps['onIncludeInferredChange']
  districtName: DatasetStatusPanelProps['districtName']
  schemaVersion: DatasetStatusPanelProps['schemaVersion']
  segmentsCount: DatasetStatusPanelProps['segmentsCount']
  inferredCount: DatasetStatusPanelProps['inferredCount']
  overrideCount: DatasetStatusPanelProps['overrideCount']
  signOverrideMatchedSegmentCount: DatasetStatusPanelProps['signOverrideMatchedSegmentCount']
  signOverrideSpatialMatchCount: DatasetStatusPanelProps['signOverrideSpatialMatchCount']
  signOverrideUnmatchedNamedCount: DatasetStatusPanelProps['signOverrideUnmatchedNamedCount']
  zonesCount: DatasetStatusPanelProps['zonesCount']
  intersectionCount: DatasetStatusPanelProps['intersectionCount']
  crosswalkCount: DatasetStatusPanelProps['crosswalkCount']
  builtAtValue?: string
  evaluationStatus: DatasetStatusPanelProps['evaluationStatus']
  datasetStatus: DatasetStatusPanelProps['datasetStatus']
  issueReportStatus: DatasetStatusPanelProps['issueReportStatus']
  reportingIssue: DatasetStatusPanelProps['reportingIssue']
  clipCacheStats:
    | {
        hits: number
        misses: number
        size: number
      }
    | null
  onReportIssue: DatasetStatusPanelProps['onReportIssue']
  onExportReports: DatasetStatusPanelProps['onExportReports']
  onOpenInfo: DatasetStatusPanelProps['onOpenInfo']
}
