export interface DiffReport {
  districts?: Array<{
    districtId?: string
    severity?: string
    meta?: {
      segmentsCount?: { deltaPct?: number | null }
      signOverrideMatchedSegmentCount?: { delta?: number | null }
      signOverrideSpatialMatchCount?: { delta?: number | null }
      signOverrideUnmatchedNamedCount?: { delta?: number | null }
      curbMarkingKnownRate?: { delta?: number | null }
      restrictionTriggeredRate?: { delta?: number | null }
    }
  }>
}

export interface NightlyAlert {
  districtId: string
  severity: string
  segmentsDeltaPct: number | null
  directOverrideMatchesDelta: number | null
  spatialOverrideMatchesDelta: number | null
  unmatchedNamedOverridesDelta: number | null
  curbKnownDelta: number | null
  restrictionDelta: number | null
}

export interface NightlyIssueReportSummary {
  scope: string
  districtId: string
  count: number
  latestCreatedAt: string | null
  latestSummary: string | null
}

export interface NightlyIssueSegmentHotspot {
  scope: string
  districtId: string
  segmentId: string
  segmentName: string | null
  segmentTier: string | null
  count: number
  latestCreatedAt: string | null
  latestSummary: string | null
}

export interface NightlyIssueReasonHotspot {
  reasonCode: string
  count: number
  districtCount: number
  segmentCount: number
  latestCreatedAt: string | null
  latestDistrictId: string | null
  latestSegmentId: string | null
  latestSegmentName: string | null
}

export interface NightlyIssueArtifactOutputs {
  indexUrl: string | null
  indexPath: string | null
  workflowSummaryUrl: string | null
  workflowSummaryPath: string | null
  workflowSummaryRelativePath: string | null
  indexSummaryUrl: string | null
  indexSummaryPath: string | null
  indexSummaryRelativePath: string | null
  indexSummaryJsonUrl: string | null
  indexSummaryJsonPath: string | null
  indexSummaryJsonRelativePath: string | null
  indexSurfaceUrl: string | null
  indexSurfacePath: string | null
  indexSurfaceRelativePath: string | null
  packetSummaryUrl: string | null
  packetSummaryPath: string | null
  packetSummaryRelativePath: string | null
  packetManifestUrl: string | null
  packetManifestPath: string | null
  packetManifestRelativePath: string | null
  packetRootPath: string | null
  packetRootUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  preferredCsvUrl: string | null
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  packetUrl: string | null
  csvUrl: string | null
}

export interface NightlyPublishGateDistrictSummary {
  districtId: string
  warn: number
  fail: number
  topWarnCodes: string[]
  topFailCodes: string[]
  signOverrideBreakdown: {
    matchedBySegmentId: number | null
    matchedBySpatial: number | null
    unmatchedNamed: number | null
  } | null
}

export interface NightlyPublishGateSummary {
  generatedAt: string
  mode: 'strict' | 'warn'
  exitCode: number
  allowWarn: boolean
  allowFail: boolean
  overrideReason: string | null
  totals: {
    info: number
    warn: number
    fail: number
  }
  topDistricts: NightlyPublishGateDistrictSummary[]
  summaryPath: string | null
  summaryUrl: string | null
}

export interface NotifyNightlyArgs {
  diffPaths: string[]
  syncStorePath: string | null
  issueInputPath: string | null
  issueLimit: number
  issuePacketOutPath: string | null
  issueCsvOutPath: string | null
  issuePacketIssueLimit: number
  issueInputUrl: string | null
  issuePacketUrl: string | null
  issueCsvUrl: string | null
  publishGateSummaryPath: string | null
  publishGateSummaryUrl: string | null
}
