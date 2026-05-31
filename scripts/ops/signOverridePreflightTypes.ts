export interface SignOverridePreflightArgs {
  configPath: string | null
  inputPath: string | null
  json: boolean
  outPath: string | null
}

export interface SignOverridePreflightIssue {
  segmentId: string
  status: 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'
  createdAt: string
  note?: string | null
}

export interface SignOverrideInvalidReportIssue {
  reportNumber: number
  districtId: string | null
  segmentId: string | null
  status: string | null
  reasons: string[]
}

export interface SignOverridePreflightResult {
  districtId: string
  districtName: string
  configPath: string
  inputPath: string
  inputExists: boolean
  inputWarning: string | null
  knownSegments: number
  rawReports: number
  validReports: number
  skippedInvalidReports: number
  skippedForeignDistrictReports: number
  effectiveOverrides: number
  duplicateSegmentsCollapsed: number
  matchedSegmentOverrides: number
  missingSegmentOverrides: number
  statusCounts: Record<'LEGAL' | 'ILLEGAL' | 'UNCLEAR', number>
  missingSegmentIds: string[]
  duplicateSegmentIds: string[]
  missingIssues: SignOverridePreflightIssue[]
  invalidReportIssues?: SignOverrideInvalidReportIssue[]
}
