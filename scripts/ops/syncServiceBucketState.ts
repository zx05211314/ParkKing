import { DEFAULT_SYNC_SCOPE, normalizeScope } from './syncServiceConfig'
import type { SyncServiceBucket, SyncServiceStore } from './syncServiceTypes'

export const createEmptySyncServiceBucket = (): SyncServiceBucket => ({
  savedPlans: [],
  reports: [],
  issueReports: [],
  savedPlansRevision: 0,
  reportsRevision: 0,
  issueReportsRevision: 0,
  savedPlansUpdatedAt: null,
  reportsUpdatedAt: null,
  issueReportsUpdatedAt: null,
})

export const normalizeSyncServiceBucket = (value: unknown): SyncServiceBucket => {
  if (!value || typeof value !== 'object') {
    return createEmptySyncServiceBucket()
  }

  const candidate = value as Partial<SyncServiceBucket>
  return {
    savedPlans: Array.isArray(candidate.savedPlans) ? candidate.savedPlans : [],
    reports: Array.isArray(candidate.reports) ? candidate.reports : [],
    issueReports: Array.isArray(candidate.issueReports) ? candidate.issueReports : [],
    savedPlansRevision:
      typeof candidate.savedPlansRevision === 'number' &&
      Number.isFinite(candidate.savedPlansRevision) &&
      candidate.savedPlansRevision >= 0
        ? Math.floor(candidate.savedPlansRevision)
        : 0,
    reportsRevision:
      typeof candidate.reportsRevision === 'number' &&
      Number.isFinite(candidate.reportsRevision) &&
      candidate.reportsRevision >= 0
        ? Math.floor(candidate.reportsRevision)
        : 0,
    issueReportsRevision:
      typeof candidate.issueReportsRevision === 'number' &&
      Number.isFinite(candidate.issueReportsRevision) &&
      candidate.issueReportsRevision >= 0
        ? Math.floor(candidate.issueReportsRevision)
        : 0,
    savedPlansUpdatedAt:
      typeof candidate.savedPlansUpdatedAt === 'string' &&
      candidate.savedPlansUpdatedAt.trim().length > 0
        ? candidate.savedPlansUpdatedAt
        : null,
    reportsUpdatedAt:
      typeof candidate.reportsUpdatedAt === 'string' &&
      candidate.reportsUpdatedAt.trim().length > 0
        ? candidate.reportsUpdatedAt
        : null,
    issueReportsUpdatedAt:
      typeof candidate.issueReportsUpdatedAt === 'string' &&
      candidate.issueReportsUpdatedAt.trim().length > 0
        ? candidate.issueReportsUpdatedAt
        : null,
  }
}

export const ensureSyncServiceBucket = (
  store: SyncServiceStore,
  scope: string | null | undefined,
  defaultScope = DEFAULT_SYNC_SCOPE,
) => {
  const resolvedScope = normalizeScope(scope, defaultScope)
  if (!store.buckets[resolvedScope]) {
    store.buckets[resolvedScope] = createEmptySyncServiceBucket()
  }
  return {
    scope: resolvedScope,
    bucket: store.buckets[resolvedScope],
  }
}
