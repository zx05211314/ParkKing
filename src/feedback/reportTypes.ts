export type ReportStatus = 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'

export const REPORT_STATUS_PRIORITY: Record<ReportStatus, number> = {
  LEGAL: 0,
  UNCLEAR: 2,
  ILLEGAL: 3,
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  LEGAL: 'Locally verified legal',
  UNCLEAR: 'Local feedback unclear',
  ILLEGAL: 'Locally reported illegal',
}

export interface SegmentReport {
  schemaVersion: number
  districtId: string
  segmentId: string
  status: ReportStatus
  note?: string | null
  createdAt: string
}
