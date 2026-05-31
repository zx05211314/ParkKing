import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import { resolveStartupSyncHydrationDetail } from './startupSyncHydrationState'
import { SHARE_PANEL_RESOURCE_LABELS } from './sharePanelPresentation'
import type {
  SharePanelSyncStatus,
  SharePanelTimelineEntry,
} from './sharePanelTypes'

const createIdleResourceSummary = (): SharePanelSyncStatus['resourceSummaries'][SyncRuntimeResource] => ({
  mode: 'idle',
  pendingCount: 0,
  hasRemoteUpdates: false,
  lastPull: null,
  lastPush: null,
  lastFailure: null,
  failureReason: null,
  retry: null,
})

export const buildSharePanelTimeline = (
  syncStatus: SharePanelSyncStatus,
): SharePanelTimelineEntry[] => {
  const startupDetail = resolveStartupSyncHydrationDetail(
    syncStatus.startupSyncHydrationPhase,
    syncStatus.startupSyncHydrationSource,
    syncStatus.startupSyncHydrationCompletedAgo,
  )
  const timelineEntries: SharePanelTimelineEntry[] = []

  if (startupDetail) {
    timelineEntries.push({
      id: 'startup',
      label: 'Startup',
      value: startupDetail,
      statusClassName:
        syncStatus.startupSyncHydrationSource === 'local-fallback'
          ? 'status-warning'
          : syncStatus.startupSyncHydrationSource === 'shared'
            ? 'status-success'
            : 'status-warning',
    })
  }

  if (syncStatus.detail) {
    timelineEntries.push({
      id: 'remote-status',
      label: 'Remote status',
      value: syncStatus.detail,
      statusClassName: '',
    })
  }

  for (const resource of Object.keys(
    SHARE_PANEL_RESOURCE_LABELS,
  ) as SyncRuntimeResource[]) {
    const summary =
      syncStatus.resourceSummaries[resource] ?? createIdleResourceSummary()
    const resourceLabel = SHARE_PANEL_RESOURCE_LABELS[resource]
    if (summary.lastPull) {
      timelineEntries.push({
        id: `${resource}-pull`,
        label: `${resourceLabel} pull`,
        value: summary.lastPull,
        statusClassName: 'status-success',
      })
    }
    if (summary.lastPush) {
      timelineEntries.push({
        id: `${resource}-push`,
        label: `${resourceLabel} push`,
        value: summary.lastPush,
        statusClassName: 'status-success',
      })
    }
    if (summary.lastFailure) {
      timelineEntries.push({
        id: `${resource}-failure`,
        label: `${resourceLabel} failure`,
        value: summary.failureReason
          ? `${summary.lastFailure} | ${summary.failureReason}`
          : summary.lastFailure,
        statusClassName: 'status-error',
      })
    }
    if (summary.retry) {
      timelineEntries.push({
        id: `${resource}-retry`,
        label: `${resourceLabel} retry`,
        value: summary.retry,
        statusClassName: 'status-warning',
      })
    }
  }

  return timelineEntries
}
