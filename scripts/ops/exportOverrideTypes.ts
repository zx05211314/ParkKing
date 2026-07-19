export type ReportStatus = 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'

export interface SegmentReport {
  schemaVersion?: number
  districtId: string
  segmentId: string
  status: ReportStatus
  note?: string | null
  createdAt: string
  reviewedSegmentId?: string
  reviewedHhmm?: string
}

export interface ReportStore {
  reports?: SegmentReport[]
}

export interface ExportOverridesArgs {
  inputPath: string | null
  outDir: string
}

export interface ExportOverridesParams {
  inputPath: string
  outDir?: string
}

export interface ExportOverridesResult {
  districtId: string
  outputPath: string
  count: number
}

export const REPORTS_STORAGE_KEY = 'pk.segmentReports.v1'
export const REPORT_SCHEMA_VERSION = 2
