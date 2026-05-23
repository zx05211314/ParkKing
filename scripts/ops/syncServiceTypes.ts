export interface SyncServiceConfig {
  path: string
  port: number
  storageFile: string
  defaultScope: string
}

export interface SyncServiceBucket {
  savedPlans: unknown[]
  reports: unknown[]
  issueReports: unknown[]
  savedPlansRevision: number
  reportsRevision: number
  issueReportsRevision: number
  savedPlansUpdatedAt: string | null
  reportsUpdatedAt: string | null
  issueReportsUpdatedAt: string | null
}

export interface SyncServiceStore {
  schemaVersion: number
  buckets: Record<string, SyncServiceBucket>
  savedPlans?: unknown[]
  reports?: unknown[]
}

export interface SavedPlansEnvelope {
  plans?: unknown
  revision?: unknown
}

export interface ReportsEnvelope {
  report?: unknown
}

export interface IssueReportsEnvelope {
  issue?: unknown
}

export interface SyncStatusSnapshot {
  scope: string
  savedPlansRevision: number
  reportsRevision: number
  issueReportsRevision: number
  savedPlansCount: number
  reportsCount: number
  issueReportsCount: number
  savedPlansUpdatedAt: string | null
  reportsUpdatedAt: string | null
  issueReportsUpdatedAt: string | null
}

export type SyncBootstrapResource = 'savedPlans' | 'reports'

export interface SyncService {
  getSyncStatus(scope?: string | null): Promise<SyncStatusSnapshot>
  getSavedPlansState(scope?: string | null): Promise<{
    plans: unknown[]
    revision: number
  }>
  getSavedPlans(scope?: string | null): Promise<unknown[]>
  replaceSavedPlans(
    plans: unknown,
    scope?: string | null,
    expectedRevision?: number | null,
  ): Promise<
    | {
        conflict: false
        plans: unknown[]
        revision: number
      }
    | {
        conflict: true
        plans: unknown[]
        revision: number
      }
  >
  getReportsState(scope?: string | null): Promise<{
    reports: unknown[]
    revision: number
  }>
  getReports(scope?: string | null): Promise<unknown[]>
  getIssueReportsState(scope?: string | null): Promise<{
    issues: unknown[]
    revision: number
  }>
  getIssueReports(scope?: string | null): Promise<unknown[]>
  getBootstrapState(
    scope?: string | null,
    resources?: SyncBootstrapResource[],
  ): Promise<Record<string, unknown>>
  appendReport(
    report: unknown,
    scope?: string | null,
  ): Promise<{
    report: unknown
    revision: number
  }>
  appendIssueReport(
    issue: unknown,
    scope?: string | null,
  ): Promise<{
    issue: unknown
    revision: number
  }>
}
