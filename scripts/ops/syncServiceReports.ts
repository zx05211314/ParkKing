import { ensureSyncServiceBucket } from './syncServiceState'
import { dedupeSyncReports } from './syncServiceReportDedupe'
import type { SyncServiceStore } from './syncServiceTypes'

export const readSyncReportsState = (
  store: SyncServiceStore,
  scope: string | null | undefined,
  defaultScope: string,
) => {
  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  return {
    reports: bucket.reports,
    revision: bucket.reportsRevision,
  }
}

export const appendSyncReport = (params: {
  store: SyncServiceStore
  scope: string | null | undefined
  defaultScope: string
  report: unknown
  updatedAt: string
}) => {
  const { store, scope, defaultScope, report, updatedAt } = params
  if (!report || typeof report !== 'object') {
    throw new Error('Report payload must include a report object.')
  }

  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  const nextReports = dedupeSyncReports([...bucket.reports, report])
  if (JSON.stringify(nextReports) === JSON.stringify(bucket.reports)) {
    return {
      changed: false,
      result: {
        report,
        revision: bucket.reportsRevision,
      },
    }
  }

  bucket.reports = nextReports
  bucket.reportsRevision += 1
  bucket.reportsUpdatedAt = updatedAt
  return {
    changed: true,
    result: {
      report,
      revision: bucket.reportsRevision,
    },
  }
}
