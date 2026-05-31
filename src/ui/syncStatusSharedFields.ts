import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import {
  buildFreshnessDetail,
  buildRuntimeDiagnostics,
  buildRuntimeSummaries,
  capitalizeSentence,
  describeRuntimeDegradation,
  formatRelativeAge,
  listPendingRuntimeResourceKeys,
  listRemoteUpdateResources,
  SYNC_STATUS_RESOURCE_LABELS,
} from './syncStatusRuntime'
import type { SyncStatusSharedResultFields } from './syncStatusResult'
import type {
  BuildSyncStatusMessageOptions,
  SyncStatusMessage,
} from './syncStatusMessageTypes'

export interface OfflineSyncAppliers {
  applyOfflineKind: (kind: SyncStatusMessage['kind']) => SyncStatusMessage['kind']
  applyOfflineMessage: (message: string) => string
  offlineNotice: string | null
}

export const buildOfflineSyncAppliers = (
  isOnline: BuildSyncStatusMessageOptions['isOnline'] = null,
): OfflineSyncAppliers => {
  const offlineNotice =
    isOnline === false
      ? 'Browser is offline. Remote sync will resume when the connection returns.'
      : null
  return {
    offlineNotice,
    applyOfflineMessage: (message: string) =>
      offlineNotice ? `${message} Browser is offline.` : message,
    applyOfflineKind: (kind: SyncStatusMessage['kind']) =>
      offlineNotice && kind === 'success' ? 'warning' : kind,
  }
}

export const buildSyncStatusSharedFields = ({
  snapshot,
  localSavedPlansRevision,
  localReportsRevision,
  runtimeSnapshot,
  nowMs = Date.now(),
  startupSyncHydrationCompletedAt = null,
  startupSyncHydrationPhase,
  startupSyncHydrationSource = null,
  offlineNotice,
}: Pick<
  BuildSyncStatusMessageOptions,
  | 'snapshot'
  | 'localSavedPlansRevision'
  | 'localReportsRevision'
  | 'runtimeSnapshot'
  | 'nowMs'
  | 'startupSyncHydrationCompletedAt'
  | 'startupSyncHydrationPhase'
  | 'startupSyncHydrationSource'
> & {
  offlineNotice: string | null
}): {
  degradationMessage: string | null
  detail: string | null
  hasSavedPlanUpdates: boolean
  hasReportUpdates: boolean
  sharedResultFields: SyncStatusSharedResultFields
} => {
  const degradationMessage = describeRuntimeDegradation(runtimeSnapshot)
  const detail = buildFreshnessDetail(snapshot, runtimeSnapshot, nowMs)
  const resourceDiagnostics = buildRuntimeDiagnostics(runtimeSnapshot, nowMs)
  const resourceSummaries = buildRuntimeSummaries(
    snapshot,
    localSavedPlansRevision,
    localReportsRevision,
    runtimeSnapshot,
    nowMs,
  )
  const generalDiagnostics = offlineNotice ? [offlineNotice] : []
  const diagnostics = [
    ...generalDiagnostics,
    ...(Object.entries(resourceDiagnostics) as Array<[SyncRuntimeResource, string[]]>).flatMap(
      ([resource, resourceLines]) =>
        resourceLines.map(
          (line) =>
            `${capitalizeSentence(SYNC_STATUS_RESOURCE_LABELS[resource])}: ${line}`,
        ),
    ),
  ]
  const retryableResources = listPendingRuntimeResourceKeys(runtimeSnapshot)
  const remoteUpdateResources = listRemoteUpdateResources(
    snapshot,
    localSavedPlansRevision,
    localReportsRevision,
  )
  const canRetryWrites = retryableResources.length > 0
  const nextRetryAt = canRetryWrites
    ? retryableResources.reduce<number | null>((earliestRetryAt, resource) => {
        const resourceRetryAt = runtimeSnapshot[resource].nextRetryAt
        const normalizedRetryAt =
          resourceRetryAt === null || resourceRetryAt <= nowMs
            ? nowMs
            : resourceRetryAt
        if (earliestRetryAt === null) {
          return normalizedRetryAt
        }
        return Math.min(earliestRetryAt, normalizedRetryAt)
      }, null)
    : null
  const retryableResourceCounts = {
    savedPlans: runtimeSnapshot.savedPlans.pendingCount,
    reports: runtimeSnapshot.reports.pendingCount,
    issueReports: runtimeSnapshot.issueReports?.pendingCount ?? 0,
  }

  return {
    degradationMessage,
    detail,
    hasSavedPlanUpdates: remoteUpdateResources.includes('savedPlans'),
    hasReportUpdates: remoteUpdateResources.includes('reports'),
    sharedResultFields: {
      diagnostics,
      generalDiagnostics,
      resourceDiagnostics,
      resourceSummaries,
      remoteUpdateResources,
      startupSyncHydrationCompletedAgo:
        startupSyncHydrationCompletedAt !== null
          ? formatRelativeAge(startupSyncHydrationCompletedAt, nowMs)
          : null,
      startupSyncHydrationPhase,
      startupSyncHydrationSource,
      canRetryWrites,
      nextRetryAt,
      retryableResources,
      retryableResourceCounts,
    },
  }
}
