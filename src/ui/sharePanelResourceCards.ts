import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import {
  resolveSharePanelResourceCapabilityLabel,
  resolveSharePanelResourceModeClassName,
  resolveSharePanelResourceModeLabel,
  resolveSharePanelResourceNote,
  SHARE_PANEL_RESOURCE_LABELS,
} from './sharePanelPresentation'
import type {
  SharePanelResourceCard,
  SharePanelSyncStatus,
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

const resolveResourceSummary = (
  syncStatus: SharePanelSyncStatus,
  resource: SyncRuntimeResource,
) => syncStatus.resourceSummaries[resource] ?? createIdleResourceSummary()

const shouldRenderSharePanelResourceCard = (
  syncStatus: SharePanelSyncStatus,
  resource: SyncRuntimeResource,
) => {
  const diagnostics = syncStatus.resourceDiagnostics[resource] ?? []
  const summary = resolveResourceSummary(syncStatus, resource)
  const pendingCount = syncStatus.retryableResourceCounts[resource] ?? 0
  const canRetry = syncStatus.retryableResources.includes(resource)

  return (
    (resource === 'issueReports' && summary.mode !== 'idle') ||
    diagnostics.length > 0 ||
    pendingCount > 0 ||
    canRetry ||
    summary.lastPull !== null ||
    summary.lastPush !== null ||
    summary.lastFailure !== null ||
    summary.retry !== null
  )
}

export const buildSharePanelResourceCards = (
  syncStatus: SharePanelSyncStatus,
): SharePanelResourceCard[] =>
  (
    Object.keys(SHARE_PANEL_RESOURCE_LABELS) as SyncRuntimeResource[]
  ).flatMap((resource) => {
    if (!shouldRenderSharePanelResourceCard(syncStatus, resource)) {
      return []
    }

    const diagnostics = syncStatus.resourceDiagnostics[resource] ?? []
    const summary = resolveResourceSummary(syncStatus, resource)
    const pendingCount = syncStatus.retryableResourceCounts[resource] ?? 0
    const canRetry = syncStatus.retryableResources.includes(resource)
    const capabilityLabel = resolveSharePanelResourceCapabilityLabel(resource)
    const note = resolveSharePanelResourceNote(resource)

    return [
      {
        resource,
        label: SHARE_PANEL_RESOURCE_LABELS[resource],
        modeLabel: resolveSharePanelResourceModeLabel(resource, summary.mode),
        modeClassName: resolveSharePanelResourceModeClassName(summary.mode),
        ...(capabilityLabel ? { capabilityLabel } : {}),
        ...(note ? { note } : {}),
        hasRemoteUpdates: summary.hasRemoteUpdates,
        diagnostics,
        pendingCount,
        canRetry,
      },
    ]
  })
