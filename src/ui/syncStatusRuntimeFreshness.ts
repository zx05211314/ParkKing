import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { SyncStatusSnapshot } from '../api/syncStatus'
import {
  SYNC_STATUS_RESOURCE_LABELS,
  formatRelativeAge,
  parseTimestampMs,
} from './syncStatusRuntimeFormatting'
import type { SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'

export const buildFreshnessDetail = (
  snapshot: SyncStatusSnapshot | null,
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
  nowMs: number,
) => {
  const parts: string[] = []

  const timestamps: Record<SyncRuntimeResource, number | null> = {
    savedPlans: snapshot
      ? parseTimestampMs(snapshot.savedPlansUpdatedAt)
      : runtimeSnapshot.savedPlans.lastRemoteAt,
    reports: snapshot
      ? parseTimestampMs(snapshot.reportsUpdatedAt)
      : runtimeSnapshot.reports.lastRemoteAt,
    issueReports: snapshot
      ? parseTimestampMs(snapshot.issueReportsUpdatedAt)
      : runtimeSnapshot.issueReports.lastRemoteAt,
  }

  ;(Object.entries(timestamps) as Array<[SyncRuntimeResource, number | null]>).forEach(
    ([resource, timestampMs]) => {
      if (timestampMs === null) {
        return
      }
      parts.push(
        `${SYNC_STATUS_RESOURCE_LABELS[resource]} ${formatRelativeAge(timestampMs, nowMs)}`,
      )
    },
  )

  if (parts.length === 0) {
    return null
  }

  return `Last remote confirmation: ${parts.join('; ')}.`
}
