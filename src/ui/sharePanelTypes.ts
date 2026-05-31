import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { SyncStatusMessage } from './syncStatusMessage'

export type SharePanelSyncStatus = Pick<
  SyncStatusMessage,
  | 'kind'
  | 'message'
  | 'detail'
  | 'syncScope'
  | 'diagnostics'
  | 'generalDiagnostics'
  | 'resourceDiagnostics'
  | 'resourceSummaries'
  | 'startupSyncHydrationCompletedAgo'
  | 'startupSyncHydrationPhase'
  | 'startupSyncHydrationSource'
  | 'canRetryWrites'
  | 'retryableResources'
  | 'retryableResourceCounts'
>

export interface SharePanelResourceCard {
  resource: SyncRuntimeResource
  label: string
  modeLabel: string
  modeClassName: string
  capabilityLabel?: string
  note?: string
  hasRemoteUpdates: boolean
  diagnostics: string[]
  pendingCount: number
  canRetry: boolean
}

export interface SharePanelTimelineEntry {
  id: string
  label: string
  value: string
  statusClassName: string
}

export interface SharePanelSyncModel {
  message: string
  syncScope: string | null
  statusChipLabel: string
  statusClassName: string
  showPendingWriteCount: boolean
  pendingWriteCount: number
  generalDiagnostics: string[]
  timelineEntries: SharePanelTimelineEntry[]
  resourceCards: SharePanelResourceCard[]
}
