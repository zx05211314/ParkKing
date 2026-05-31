export const ISSUE_REPORTS_SCHEMA_VERSION = 1

export interface IssueReport {
  schemaVersion: number
  issueId: string
  districtId: string | null
  segmentId: string | null
  summary: string
  createdAt: string
  bundle: unknown
}

