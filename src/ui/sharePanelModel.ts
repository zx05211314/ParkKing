import {
  resolveSharePanelStartupStatusChipLabel,
  resolveSharePanelStatusChipLabel,
  resolveSharePanelStatusClassName,
} from './sharePanelPresentation'
import { buildSharePanelResourceCards } from './sharePanelResourceCards'
import { buildSharePanelTimeline } from './sharePanelTimeline'
import type {
  SharePanelSyncModel,
  SharePanelSyncStatus,
} from './sharePanelTypes'

export const buildSharePanelSyncModel = (
  syncStatus: SharePanelSyncStatus,
): SharePanelSyncModel => {
  const pendingWriteCount = syncStatus.retryableResources
    .map((resource) => syncStatus.retryableResourceCounts[resource])
    .reduce((sum, count) => sum + count, 0)

  const resourceCards = buildSharePanelResourceCards(syncStatus)
  const timelineEntries = buildSharePanelTimeline(syncStatus)
  const startupStatusChipLabel = resolveSharePanelStartupStatusChipLabel(
    syncStatus.startupSyncHydrationPhase,
  )

  return {
    message: syncStatus.message,
    syncScope: syncStatus.syncScope,
    statusChipLabel:
      startupStatusChipLabel ??
      resolveSharePanelStatusChipLabel(syncStatus.kind),
    statusClassName:
      startupStatusChipLabel !== null
        ? 'status-warning'
        : resolveSharePanelStatusClassName(syncStatus.kind),
    showPendingWriteCount: syncStatus.canRetryWrites,
    pendingWriteCount,
    generalDiagnostics: syncStatus.generalDiagnostics,
    timelineEntries,
    resourceCards,
  }
}
