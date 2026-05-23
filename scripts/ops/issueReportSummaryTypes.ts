import type { NightlyPublishGateSummary } from './notifyNightlyTypes'

export const ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_ARTIFACT_INDEX_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_SUMMARY_INDEX_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_ARTIFACT_SUMMARY_JSON_SCHEMA_VERSION = 1 as const
export const ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION = 1 as const

export type IssueReportArtifactSummaryInputArtifactType =
  | 'issue-report-workflow-artifacts'
  | 'issue-report-summary-artifacts'
  | 'issue-report-artifact-index'
  | 'issue-report-summary-index'
  | 'issue-report-summary-json'
  | 'issue-report-artifact-summary-json'
  | 'issue-report-artifact-summary-surface'

export interface IssueReportSummaryArgs {
  syncStorePath: string | null
  publishGateSummaryPath: string | null
  scope: string | null
  districtId: string | null
  segmentId: string | null
  reasonCode: string | null
  since: string | null
  limit: number
  outPath: string | null
  summaryBaseUrl: string | null
  rawOutPath: string | null
  rawBaseUrl: string | null
  csvOutPath: string | null
  csvRootUrl: string | null
  packetOutPath: string | null
  packetRootUrl: string | null
  packetIssueLimit: number
  json: boolean
}

export interface IssueReportSummaryFilters {
  scope: string | null
  districtId: string | null
  segmentId: string | null
  reasonCode: string | null
  since: string | null
}

export interface SyncIssueReportEntry {
  scope: string
  issueId: string
  districtId: string
  segmentId: string | null
  segmentName: string | null
  segmentTier: string | null
  allowedNow: string | null
  reasonCodes: string[]
  bundleGeneratedAt: string | null
  reportHhmm: string | null
  includeInferred: boolean | null
  summary: string
  createdAt: string
}

export interface SyncIssueReportRawIssue extends SyncIssueReportEntry {
  bundle: unknown
}

export interface SyncIssueReportDistrictSummary {
  scope: string
  districtId: string
  count: number
  latestCreatedAt: string | null
  latestSummary: string | null
}

export interface SyncIssueReportSegmentSummary {
  scope: string
  districtId: string
  segmentId: string
  segmentName: string | null
  segmentTier: string | null
  count: number
  latestCreatedAt: string | null
  latestSummary: string | null
}

export interface SyncIssueReportReasonSummary {
  reasonCode: string
  count: number
  districtCount: number
  segmentCount: number
  latestCreatedAt: string | null
  latestDistrictId: string | null
  latestSegmentId: string | null
  latestSegmentName: string | null
}

export interface IssueReportSummaryResult {
  storageFile: string
  storeExists: boolean
  totalCount: number
  filteredCount: number
  filters: IssueReportSummaryFilters
  summaries: SyncIssueReportDistrictSummary[]
  segmentSummaries: SyncIssueReportSegmentSummary[]
  topDistricts: SyncIssueReportDistrictSummary[]
  latestDistricts: SyncIssueReportDistrictSummary[]
  topSegments: SyncIssueReportSegmentSummary[]
  topReasons: SyncIssueReportReasonSummary[]
  issues: SyncIssueReportEntry[]
  rawIssues: SyncIssueReportRawIssue[]
}

export interface IssueReportPublishGateHotspot {
  districtId: string
  warn: number
  fail: number
  topWarnCodes: string[]
  topFailCodes: string[]
  directOverrideMatches: number | null
  spatialOverrideMatches: number | null
  unmatchedNamedOverrides: number | null
  issueHotspotSegmentId: string | null
  issueHotspotSegmentName: string | null
  issueHotspotSegmentLabel: string | null
}

export interface IssueReportPacketReasonCount {
  reasonCode: string
  count: number
}

export interface IssueReportSegmentPacket {
  packetKind: 'segment'
  rank: number
  packetId: string
  scope: string
  districtId: string
  segmentId: string
  segmentName: string | null
  segmentTier: string | null
  count: number
  latestCreatedAt: string | null
  latestSummary: string | null
  reasonCounts: IssueReportPacketReasonCount[]
  recentIssues: SyncIssueReportRawIssue[]
}

export interface IssueReportReasonPacket {
  packetKind: 'reason'
  rank: number
  packetId: string
  reasonCode: string
  count: number
  districtCount: number
  segmentCount: number
  latestCreatedAt: string | null
  latestDistrictId: string | null
  latestSegmentId: string | null
  latestSegmentName: string | null
  relatedDistricts: SyncIssueReportDistrictSummary[]
  relatedSegments: SyncIssueReportSegmentSummary[]
  recentIssues: SyncIssueReportRawIssue[]
}

export interface IssueReportTriagePacketBundle {
  generatedAt: string
  storageFile: string
  filters: IssueReportSummaryFilters
  totalCount: number
  filteredCount: number
  publishGateSummary: NightlyPublishGateSummary | null
  segmentPackets: IssueReportSegmentPacket[]
  reasonPackets: IssueReportReasonPacket[]
}

export interface IssueReportTriagePacketManifestPacketEntry {
  rank: number
  packetId: string
  packetKind: 'segment' | 'reason'
  label: string
  relativePath: string
  url: string | null
}

export interface IssueReportTriagePacketManifestCsvEntry {
  fileName: string
  path: string
  url: string | null
}

export interface IssueReportTriagePacketManifestPublishGateHotspot {
  districtId: string
  warn: number
  fail: number
  topWarnCodes: string[]
  topFailCodes: string[]
  directOverrideMatches: number | null
  spatialOverrideMatches: number | null
  unmatchedNamedOverrides: number | null
  issueHotspotSegmentId: string | null
  issueHotspotSegmentName: string | null
  issueHotspotSegmentLabel: string | null
  issueHotspotPacketPath: string | null
  issueHotspotPacketUrl: string | null
}

export interface IssueReportTriagePacketManifest {
  artifactType: 'issue-report-triage-packets'
  schemaVersion: typeof ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION
  generatedAt: string
  storageFile: string
  filters: IssueReportSummaryFilters
  totalCount: number
  filteredCount: number
  packetRootPath: string
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetBaseUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvBaseUrl: string | null
  summaryPath: string
  summaryRelativePath: string
  summaryUrl: string | null
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportTriagePacketManifestPublishGateHotspot[]
  segmentPackets: IssueReportTriagePacketManifestPacketEntry[]
  reasonPackets: IssueReportTriagePacketManifestPacketEntry[]
  csvExports: IssueReportTriagePacketManifestCsvEntry[]
}

export interface IssueReportSummaryArtifactOutputs {
  summaryPath: string | null
  summaryRelativePath: string | null
  summaryUrl: string | null
  rawIssuesPath: string | null
  rawIssuesRelativePath: string | null
  rawIssuesUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvBaseUrl: string | null
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  csvPaths: string[]
  csvRelativePaths: string[]
  packetRootPath: string | null
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetBaseUrl: string | null
  packetSummaryPath: string | null
  packetSummaryRelativePath: string | null
  packetSummaryUrl: string | null
  packetManifestPath: string | null
  packetManifestRelativePath: string | null
  packetManifestUrl: string | null
  packetPaths: string[]
  packetRelativePaths: string[]
}

export interface IssueReportSummaryJsonOutput extends IssueReportSummaryResult {
  artifactType: 'issue-report-summary-json'
  schemaVersion: typeof ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportPublishGateHotspot[]
  artifacts: IssueReportSummaryArtifactOutputs
}

export interface IssueReportSummaryIndexFileEntry {
  path: string
  relativePath: string
  url: string | null
}

export interface IssueReportSummaryIndexPublishGateHotspot
  extends IssueReportPublishGateHotspot {
  issueHotspotPacketPath: string | null
  issueHotspotPacketUrl: string | null
}

export interface IssueReportSummaryIndexOutput {
  artifactType: 'issue-report-summary-index'
  schemaVersion: typeof ISSUE_REPORT_SUMMARY_INDEX_SCHEMA_VERSION
  generatedAt: string
  sourceSummaryPath: string
  sourceSummaryArtifactType: IssueReportSummaryJsonOutput['artifactType']
  sourceSummarySchemaVersion: IssueReportSummaryJsonOutput['schemaVersion']
  storageFile: string
  totalCount: number
  filteredCount: number
  filters: IssueReportSummaryFilters
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportSummaryIndexPublishGateHotspot[]
  topDistricts: SyncIssueReportDistrictSummary[]
  topSegments: SyncIssueReportSegmentSummary[]
  topReasons: SyncIssueReportReasonSummary[]
  indexFile: IssueReportSummaryIndexFileEntry | null
  manualManifestFile: IssueReportSummaryIndexFileEntry | null
  summaryFile: IssueReportSummaryIndexFileEntry | null
  rawIssuesFile: IssueReportSummaryIndexFileEntry | null
  csvRootPath: string | null
  csvRootUrl: string | null
  csvBaseUrl: string | null
  preferredCsvFile: IssueReportSummaryIndexFileEntry | null
  csvExports: IssueReportSummaryIndexFileEntry[]
  packetRootPath: string | null
  packetRootUrl: string | null
  packetBaseUrl: string | null
  packetSummaryFile: IssueReportSummaryIndexFileEntry | null
  packetManifestFile: IssueReportSummaryIndexFileEntry | null
  packetFiles: IssueReportSummaryIndexFileEntry[]
  packetManifestArtifactType: IssueReportTriagePacketManifest['artifactType'] | null
  packetManifestSchemaVersion: IssueReportTriagePacketManifest['schemaVersion'] | null
  segmentPacketEntries: IssueReportTriagePacketManifestPacketEntry[]
  reasonPacketEntries: IssueReportTriagePacketManifestPacketEntry[]
}

export interface IssueReportWorkflowArtifactsManifestPublishGateHotspot {
  districtId: string
  segmentLabel: string | null
  packetPath: string | null
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetArtifactUrl: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvArtifactUrl: string | null
}

export interface IssueReportWorkflowArtifactsManifest {
  artifactType: 'issue-report-workflow-artifacts'
  schemaVersion: typeof ISSUE_REPORT_WORKFLOW_ARTIFACT_MANIFEST_SCHEMA_VERSION
  generatedAt: string
  outRoot: string
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportWorkflowArtifactsManifestPublishGateHotspot[]
  topDistricts: SyncIssueReportDistrictSummary[]
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetArtifactUrl: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvArtifactUrl: string | null
  packetRootPath: string
  packetSummaryPath: string
  packetSummaryRelativePath: string
  packetSummaryUrl: string | null
  packetManifestPath: string
  packetManifestRelativePath: string
  packetManifestUrl: string | null
  csvRootPath: string
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  summaryPath: string
  summaryRelativePath: string
  summaryUrl: string | null
  indexSummaryPath: string
  indexSummaryRelativePath: string
  indexSummaryUrl: string | null
  indexSummaryJsonPath: string
  indexSummaryJsonRelativePath: string
  indexSummaryJsonUrl: string | null
  indexSurfacePath: string
  indexSurfaceRelativePath: string
  indexSurfaceUrl: string | null
  artifactIndexPath: string
  artifactIndexRelativePath: string
  artifactIndexUrl: string | null
  manifestPath: string
  packetPaths: string[]
  csvPaths: string[]
  storageFile: string
  totalCount: number
  filteredCount: number
}

export interface IssueReportSummaryArtifactsManifest {
  artifactType: 'issue-report-summary-artifacts'
  schemaVersion: typeof ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION
  generatedAt: string
  outRoot: string
  sourceSummaryPath: string
  sourceSummaryRelativePath: string | null
  sourceSummaryUrl: string | null
  sourceSummaryArtifactType: IssueReportSummaryJsonOutput['artifactType']
  sourceSummarySchemaVersion: IssueReportSummaryJsonOutput['schemaVersion']
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportWorkflowArtifactsManifestPublishGateHotspot[]
  topDistricts: SyncIssueReportDistrictSummary[]
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetArtifactUrl: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvArtifactUrl: string | null
  packetRootPath: string | null
  packetSummaryPath: string | null
  packetSummaryRelativePath: string | null
  packetSummaryUrl: string | null
  packetManifestPath: string | null
  packetManifestRelativePath: string | null
  packetManifestUrl: string | null
  csvRootPath: string | null
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  summaryPath: string
  summaryRelativePath: string
  summaryUrl: string | null
  indexSummaryPath: string
  indexSummaryRelativePath: string
  indexSummaryUrl: string | null
  indexSummaryJsonPath: string
  indexSummaryJsonRelativePath: string
  indexSummaryJsonUrl: string | null
  indexSurfacePath: string
  indexSurfaceRelativePath: string
  indexSurfaceUrl: string | null
  artifactIndexPath: string
  artifactIndexRelativePath: string
  artifactIndexUrl: string | null
  manifestPath: string
  packetPaths: string[]
  csvPaths: string[]
  storageFile: string
  totalCount: number
  filteredCount: number
}

export interface IssueReportArtifactIndexRootManifestInfo {
  manifestPath: string
  artifactType: IssueReportWorkflowArtifactsManifest['artifactType']
  schemaVersion: IssueReportWorkflowArtifactsManifest['schemaVersion']
  outRoot: string
  summaryPath: string
  summaryRelativePath: string
  summaryUrl: string | null
  indexSummaryPath: string
  indexSummaryRelativePath: string
  indexSummaryUrl: string | null
  indexSummaryJsonPath: string
  indexSummaryJsonRelativePath: string
  indexSummaryJsonUrl: string | null
  indexSurfacePath: string
  indexSurfaceRelativePath: string
  indexSurfaceUrl: string | null
  artifactIndexPath: string
  artifactIndexRelativePath: string
  artifactIndexUrl: string | null
  packetManifestPath: string
  packetSummaryPath: string
  packetSummaryRelativePath: string
  packetSummaryUrl: string | null
  packetManifestRelativePath: string
  packetManifestUrl: string | null
  packetRootPath: string
  csvRootPath: string
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetArtifactUrl: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvArtifactUrl: string | null
  packetPaths: string[]
  csvPaths: string[]
  storageFile: string
  totalCount: number
  filteredCount: number
}

export interface IssueReportArtifactIndexPacketManifestInfo {
  manifestPath: string
  artifactType: IssueReportTriagePacketManifest['artifactType']
  schemaVersion: IssueReportTriagePacketManifest['schemaVersion']
  summaryPath: string
  summaryRelativePath: string
  summaryUrl: string | null
  packetRootPath: string
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetBaseUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvBaseUrl: string | null
  storageFile: string
  filters: IssueReportSummaryFilters
  totalCount: number
  filteredCount: number
}

export interface IssueReportArtifactIndexRelationSummary {
  linkedPublishGateHotspotCount: number
  totalPublishGateHotspotCount: number
  packetSegmentCount: number | null
  packetReasonCount: number | null
  packetCsvCount: number | null
}

export interface IssueReportArtifactIndexOutput {
  artifactType: 'issue-report-artifact-index'
  schemaVersion: typeof ISSUE_REPORT_ARTIFACT_INDEX_SCHEMA_VERSION
  generatedAt: string
  rootManifest: IssueReportArtifactIndexRootManifestInfo
  packetManifest: IssueReportArtifactIndexPacketManifestInfo
  relationSummary: IssueReportArtifactIndexRelationSummary
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportTriagePacketManifestPublishGateHotspot[]
  topDistricts: SyncIssueReportDistrictSummary[]
  topSegments: IssueReportSegmentPacket[]
  topReasons: IssueReportReasonPacket[]
  segmentPackets: IssueReportTriagePacketManifestPacketEntry[]
  reasonPackets: IssueReportTriagePacketManifestPacketEntry[]
  preferredCsvFile: IssueReportSummaryIndexFileEntry | null
  csvExports: IssueReportTriagePacketManifestCsvEntry[]
}

export interface IssueReportArtifactSummaryJsonTopSegmentEntry {
  districtId: string
  segmentId: string | null
  segmentName: string | null
  segmentLabel: string
  count: number
  segmentTier: string | null
  latestCreatedAt: string | null
  latestSummary: string | null
  packetPath: string | null
  packetUrl: string | null
}

export interface IssueReportArtifactSummaryJsonTopReasonEntry {
  reasonCode: string
  count: number
  districtCount: number
  segmentCount: number
  latestCreatedAt: string | null
  latestSegmentId: string | null
  latestSegmentName: string | null
  packetPath: string | null
  packetUrl: string | null
}

export interface IssueReportArtifactSummaryJsonOutput {
  artifactType: 'issue-report-artifact-summary-json'
  schemaVersion: typeof ISSUE_REPORT_ARTIFACT_SUMMARY_JSON_SCHEMA_VERSION
  generatedAt: string
  label: string | null
  inputArtifactType: IssueReportArtifactSummaryInputArtifactType
  resolvedIndexArtifactType:
    | IssueReportArtifactIndexOutput['artifactType']
    | IssueReportSummaryIndexOutput['artifactType']
  resolvedIndexSchemaVersion: number
  inputUrl: string | null
  publishGateSummaryUrl: string | null
  topCount: number
  matchingIssueReports: {
    filteredCount: number
    totalCount: number
  }
  linkedPublishGateHotspots: {
    linkedCount: number
    totalCount: number
  }
  packetEntries: {
    segmentCount: number
    reasonCount: number
  }
  summaryEntries: {
    workflowSummaryRelativePath: string | null
    indexSummaryRelativePath: string | null
    indexSummaryJsonRelativePath: string | null
    indexSurfaceRelativePath: string | null
    artifactIndexRelativePath: string | null
    manualManifestRelativePath: string | null
    sourceSummaryRelativePath: string | null
    rawIssuesRelativePath: string | null
    packetRootRelativePath: string | null
    csvRootRelativePath: string | null
    preferredCsvRelativePath: string | null
    packetSummaryRelativePath: string | null
    packetManifestRelativePath: string | null
  }
  artifactLinks: {
    summaryUrl: string | null
    indexSummaryUrl: string | null
    indexSummaryJsonUrl: string | null
    indexSurfaceUrl: string | null
    artifactIndexUrl: string | null
    manualManifestUrl: string | null
    sourceSummaryUrl: string | null
    rawIssuesUrl: string | null
    preferredCsvUrl: string | null
    packetSummaryUrl: string | null
    packetManifestUrl: string | null
    packetRootUrl: string | null
    csvRootUrl: string | null
    // Legacy compat alias for packetRootUrl.
    packetBaseUrl: string | null
    // Legacy compat alias for csvRootUrl.
    csvBaseUrl: string | null
    // Legacy compat alias for packetRootUrl.
    packetArtifactUrl: string | null
    // Legacy compat alias for csvRootUrl.
    csvArtifactUrl: string | null
  }
  publishGateSummary: NightlyPublishGateSummary | null
  publishGateHotspots: IssueReportSummaryIndexPublishGateHotspot[]
  topDistricts: SyncIssueReportDistrictSummary[]
  topSegments: IssueReportArtifactSummaryJsonTopSegmentEntry[]
  topReasons: IssueReportArtifactSummaryJsonTopReasonEntry[]
  csvExports: IssueReportSummaryIndexFileEntry[]
}

export interface IssueReportArtifactSummarySurfaceSummary {
  artifactType: 'issue-report-artifact-summary-surface'
  schemaVersion: typeof ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION
  summaryPath: string
  sourceArtifactType: IssueReportArtifactSummaryJsonOutput['artifactType']
  sourceSchemaVersion: IssueReportArtifactSummaryJsonOutput['schemaVersion']
  label: string | null
  inputArtifactType: IssueReportArtifactSummaryJsonOutput['inputArtifactType']
  resolvedIndexArtifactType: IssueReportArtifactSummaryJsonOutput['resolvedIndexArtifactType']
  resolvedIndexSchemaVersion: IssueReportArtifactSummaryJsonOutput['resolvedIndexSchemaVersion']
  topCount: number
  filteredCount: number
  totalCount: number
  linkedPublishGateHotspotCount: number
  totalPublishGateHotspotCount: number
  segmentPacketCount: number
  reasonPacketCount: number
  csvCount: number
  publishGateSummary: {
    mode: string
    exitCode: number
    info: number
    warn: number
    fail: number
  } | null
  topPublishGateHotspots: Array<{
    districtId: string
    warn: number
    fail: number
    directOverrideMatches: number | null
    spatialOverrideMatches: number | null
    unmatchedNamedOverrides: number | null
    issueHotspotSegmentLabel: string | null
    issueHotspotPacketPath: string | null
    issueHotspotPacketUrl: string | null
  }>
  topDistricts: Array<{
    scope: string
    districtId: string
    count: number
    latestCreatedAt: string | null
    latestSummary: string | null
  }>
  topSegments: Array<{
    scope: string
    districtId: string
    segmentId: string | null
    segmentName: string | null
    segmentLabel: string
    count: number
    segmentTier: string | null
    latestCreatedAt: string | null
    latestSummary: string | null
    packetPath: string | null
    packetUrl: string | null
  }>
  topReasons: Array<{
    reasonCode: string
    count: number
    districtCount: number
    segmentCount: number
    latestCreatedAt: string | null
    latestDistrictId: string | null
    latestSegmentId: string | null
    latestSegmentName: string | null
    packetPath: string | null
    packetUrl: string | null
  }>
  packetRootPath: string | null
  packetRootRelativePath: string | null
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetBaseUrl: string | null
  csvRootPath: string | null
  csvRootRelativePath: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvBaseUrl: string | null
  workflowSummaryRelativePath: string | null
  workflowSummaryUrl: string | null
  indexSummaryRelativePath: string | null
  indexSummaryUrl: string | null
  indexSummaryJsonRelativePath: string | null
  indexSummaryJsonUrl: string | null
  indexSurfaceRelativePath: string | null
  indexSurfaceUrl: string | null
  artifactIndexRelativePath: string | null
  artifactIndexUrl: string | null
  manualManifestRelativePath: string | null
  manualManifestUrl: string | null
  sourceSummaryRelativePath: string | null
  sourceSummaryUrl: string | null
  rawIssuesRelativePath: string | null
  rawIssuesUrl: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  packetSummaryRelativePath: string | null
  packetManifestRelativePath: string | null
  packetSummaryUrl: string | null
  packetManifestUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetArtifactUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvArtifactUrl: string | null
}

export type IssueReportArtifactManifest =
  | IssueReportTriagePacketManifest
  | IssueReportWorkflowArtifactsManifest
  | IssueReportSummaryArtifactsManifest
