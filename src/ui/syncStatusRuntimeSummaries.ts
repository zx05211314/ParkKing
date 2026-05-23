import type { SyncRuntimeResource, SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'
import type { SyncStatusSnapshot } from '../api/syncStatus'
import {
  formatRelativeAge,
  formatRelativeDelay,
  formatRetrySourceLabel,
} from './syncStatusRuntimeFormatting'
import type { SyncStatusRuntimeResourceSummary } from './syncStatusRuntimeTypes'

const createIdleRuntimeSummary = (): SyncStatusRuntimeResourceSummary => ({
  mode: 'idle',
  pendingCount: 0,
  hasRemoteUpdates: false,
  lastPull: null,
  lastPush: null,
  lastFailure: null,
  failureReason: null,
  retry: null,
})

export const buildRuntimeSummaries = (
  snapshot: SyncStatusSnapshot | null,
  localSavedPlansRevision: number | null,
  localReportsRevision: number | null,
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
  nowMs: number,
): Record<SyncRuntimeResource, SyncStatusRuntimeResourceSummary> => {
  const hasSavedPlanUpdates =
    snapshot !== null &&
    localSavedPlansRevision !== null &&
    snapshot.savedPlansRevision > localSavedPlansRevision
  const hasReportUpdates =
    snapshot !== null &&
    localReportsRevision !== null &&
    snapshot.reportsRevision > localReportsRevision
  const summaries = {
    savedPlans: createIdleRuntimeSummary(),
    reports: createIdleRuntimeSummary(),
    issueReports: createIdleRuntimeSummary(),
  }

  ;(Object.entries(runtimeSnapshot) as Array<
    [SyncRuntimeResource, SyncRuntimeStatusSnapshot[SyncRuntimeResource]]
  >).forEach(([resource, status]) => {
    const retrySourceLabel = formatRetrySourceLabel(status.lastRetrySource)
    summaries[resource] = {
      mode: status.mode,
      pendingCount: status.pendingCount,
      hasRemoteUpdates:
        resource === 'savedPlans'
          ? hasSavedPlanUpdates
          : resource === 'reports'
            ? hasReportUpdates
            : false,
      lastPull:
        status.lastRemoteAt !== null
          ? `${formatRelativeAge(status.lastRemoteAt, nowMs)}${
              status.lastRemoteCount !== null ? ` (${status.lastRemoteCount} remote)` : ''
            }`
          : null,
      lastPush:
        status.lastPushAt !== null
          ? `${formatRelativeAge(status.lastPushAt, nowMs)}${
              status.lastPushCount !== null ? ` (${status.lastPushCount} confirmed)` : ''
            }`
          : null,
      lastFailure:
        status.lastFailureAt !== null
          ? formatRelativeAge(status.lastFailureAt, nowMs)
          : null,
      failureReason: status.lastFailureReason,
      retry:
        status.pendingCount > 0 && status.retryAttemptCount > 0
          ? status.nextRetryAt !== null && status.nextRetryAt > nowMs
            ? `${retrySourceLabel} ${status.retryAttemptCount} ${formatRelativeDelay(
                status.nextRetryAt,
                nowMs,
              )}`
            : `${retrySourceLabel} ${status.retryAttemptCount} now`
          : null,
    }
  })

  return summaries as Record<SyncRuntimeResource, SyncStatusRuntimeResourceSummary>
}
