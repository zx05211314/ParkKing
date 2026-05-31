import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type {
  StartupSyncHydrationPhase,
  StartupSyncHydrationSource,
} from './startupSyncHydrationState'
import type {
  SyncStatusMessage,
  SyncStatusResourceSummary,
} from './syncStatusMessageTypes'

export interface SyncStatusSharedResultFields {
  diagnostics: string[]
  generalDiagnostics: string[]
  resourceDiagnostics: Record<SyncRuntimeResource, string[]>
  resourceSummaries: Record<SyncRuntimeResource, SyncStatusResourceSummary>
  remoteUpdateResources: SyncRuntimeResource[]
  startupSyncHydrationCompletedAgo: string | null
  startupSyncHydrationPhase: StartupSyncHydrationPhase
  startupSyncHydrationSource: StartupSyncHydrationSource
  canRetryWrites: boolean
  nextRetryAt: number | null
  retryableResources: SyncRuntimeResource[]
  retryableResourceCounts: Record<SyncRuntimeResource, number>
}

export const describeRemoteUpdateTarget = (
  hasSavedPlanUpdates: boolean,
  hasReportUpdates: boolean,
) => {
  if (hasSavedPlanUpdates && hasReportUpdates) {
    return 'saved plans and reports'
  }
  if (hasSavedPlanUpdates) {
    return 'saved plans'
  }
  return 'reports'
}

export const buildWaitingSyncMessage = ({
  degradationMessage,
  startupSyncHydrationPhase,
  startupSyncHydrationSource,
}: {
  degradationMessage: string | null
  startupSyncHydrationPhase: StartupSyncHydrationPhase
  startupSyncHydrationSource: StartupSyncHydrationSource
}) => {
  if (startupSyncHydrationPhase === 'local-fallback') {
    return 'Sync connected. Loading local fallback state...'
  }
  if (startupSyncHydrationPhase === 'sync-bootstrap') {
    return 'Sync connected. Bootstrapping shared state...'
  }
  if (degradationMessage) {
    return `Sync connected. ${degradationMessage}`
  }
  if (startupSyncHydrationSource === 'local-fallback') {
    return 'Sync connected. Local fallback state loaded; waiting for remote status...'
  }
  if (startupSyncHydrationSource === 'shared') {
    return 'Sync connected. Shared state loaded; waiting for remote status...'
  }
  return 'Sync connected. Waiting for remote status...'
}

export const buildSyncStatusResult = (
  sharedFields: SyncStatusSharedResultFields,
  {
    kind,
    message,
    detail,
    syncScope,
    remoteUpdateKey,
  }: Pick<
    SyncStatusMessage,
    'kind' | 'message' | 'detail' | 'syncScope' | 'remoteUpdateKey'
  >,
): SyncStatusMessage => ({
  kind,
  message,
  detail,
  syncScope,
  remoteUpdateKey,
  ...sharedFields,
})
