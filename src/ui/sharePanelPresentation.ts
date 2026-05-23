import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import {
  ISSUE_REPORT_SYNC_CAPABILITY_LABEL,
  ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE,
} from './issueReportSyncPresentation'
import type { SharePanelSyncStatus } from './sharePanelTypes'

export const SHARE_PANEL_RESOURCE_LABELS: Record<SyncRuntimeResource, string> = {
  savedPlans: 'Saved plans',
  reports: 'Reports',
  issueReports: 'Issue reports',
}

export const resolveSharePanelResourceModeLabel = (
  resource: SyncRuntimeResource,
  mode: SharePanelSyncStatus['resourceSummaries'][SyncRuntimeResource]['mode'],
) => {
  if (resource === 'issueReports') {
    switch (mode) {
      case 'remote':
        return 'Uploaded'
      case 'syncing':
        return 'Queued'
      case 'fallback-local':
        return 'Local queue'
      case 'local-only':
        return 'Device only'
      case 'idle':
        return 'Idle'
    }
  }

  switch (mode) {
    case 'remote':
      return 'Synced'
    case 'syncing':
      return 'Pending'
    case 'fallback-local':
      return 'Fallback'
    case 'local-only':
      return 'Local only'
    case 'idle':
      return 'Idle'
  }
}

export const resolveSharePanelResourceModeClassName = (
  mode: SharePanelSyncStatus['resourceSummaries'][SyncRuntimeResource]['mode'],
) => {
  switch (mode) {
    case 'remote':
      return 'status-success'
    case 'syncing':
      return 'status-warning'
    case 'fallback-local':
      return 'status-error'
    case 'local-only':
      return 'status-warning'
    default:
      return ''
  }
}

export const resolveSharePanelResourceCapabilityLabel = (
  resource: SyncRuntimeResource,
) => {
  if (resource === 'issueReports') {
    return ISSUE_REPORT_SYNC_CAPABILITY_LABEL
  }
  return null
}

export const resolveSharePanelResourceNote = (
  resource: SyncRuntimeResource,
) => {
  if (resource === 'issueReports') {
    return ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE
  }
  return null
}

export const resolveSharePanelStatusClassName = (
  kind: SharePanelSyncStatus['kind'],
) => {
  switch (kind) {
    case 'error':
      return 'status-error'
    case 'warning':
      return 'status-warning'
    case 'success':
      return 'status-success'
    default:
      return ''
  }
}

export const resolveSharePanelStatusChipLabel = (
  kind: SharePanelSyncStatus['kind'],
) => {
  switch (kind) {
    case 'local':
      return 'Local only'
    case 'success':
      return 'Synced'
    case 'warning':
      return 'Attention'
    case 'error':
      return 'Error'
  }
}

export const resolveSharePanelStartupStatusChipLabel = (
  phase: SharePanelSyncStatus['startupSyncHydrationPhase'],
) => {
  switch (phase) {
    case 'sync-bootstrap':
      return 'Bootstrapping'
    case 'local-fallback':
      return 'Loading local'
    case 'ready':
      return null
  }
}
