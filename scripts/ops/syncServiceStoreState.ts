import { DEFAULT_SYNC_SCOPE, STORE_SCHEMA_VERSION } from './syncServiceConfig'
import { createEmptySyncServiceBucket } from './syncServiceBucketState'
import type {
  SyncServiceBucket,
  SyncServiceStore,
  SyncStatusSnapshot,
} from './syncServiceTypes'

export const createLegacySyncServiceStore = (
  savedPlans: unknown,
  reports: unknown,
  defaultScope = DEFAULT_SYNC_SCOPE,
): SyncServiceStore => ({
  schemaVersion: STORE_SCHEMA_VERSION,
  buckets: {
    [defaultScope]: {
      ...createEmptySyncServiceBucket(),
      savedPlans: Array.isArray(savedPlans) ? savedPlans : [],
      reports: Array.isArray(reports) ? reports : [],
    },
  },
})

export const readSyncStatusSnapshot = (
  bucket: SyncServiceBucket,
  scope: string,
): SyncStatusSnapshot => ({
  scope,
  savedPlansRevision: bucket.savedPlansRevision,
  reportsRevision: bucket.reportsRevision,
  issueReportsRevision: bucket.issueReportsRevision,
  savedPlansCount: bucket.savedPlans.length,
  reportsCount: bucket.reports.length,
  issueReportsCount: bucket.issueReports.length,
  savedPlansUpdatedAt: bucket.savedPlansUpdatedAt,
  reportsUpdatedAt: bucket.reportsUpdatedAt,
  issueReportsUpdatedAt: bucket.issueReportsUpdatedAt,
})
