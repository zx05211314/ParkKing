import type { SyncRuntimeResource, SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'
import type { SyncStatusSnapshot } from '../api/syncStatus'
import type {
  StartupSyncHydrationPhase,
  StartupSyncHydrationSource,
} from './startupSyncHydrationState'
import type { SyncStatusRuntimeResourceSummary } from './syncStatusRuntimeTypes'

export type SyncStatusResourceSummary = SyncStatusRuntimeResourceSummary

export interface SyncStatusMessage {
  kind: 'local' | 'success' | 'warning' | 'error'
  message: string
  detail: string | null
  syncScope: string | null
  diagnostics: string[]
  generalDiagnostics: string[]
  resourceDiagnostics: Record<SyncRuntimeResource, string[]>
  resourceSummaries: Record<SyncRuntimeResource, SyncStatusResourceSummary>
  remoteUpdateKey: string | null
  remoteUpdateResources: SyncRuntimeResource[]
  startupSyncHydrationCompletedAgo: string | null
  startupSyncHydrationPhase: StartupSyncHydrationPhase
  startupSyncHydrationSource: StartupSyncHydrationSource
  canRetryWrites: boolean
  nextRetryAt: number | null
  retryableResources: SyncRuntimeResource[]
  retryableResourceCounts: Record<SyncRuntimeResource, number>
}

export interface BuildSyncStatusMessageOptions {
  hasSyncBaseUrl: boolean
  hasSavedPlansEndpoint: boolean
  hasReportsEndpoint: boolean
  hasIssueReportsEndpoint?: boolean
  hasStatusEndpoint: boolean
  statusError: boolean
  statusErrorMessage?: string | null
  snapshot: SyncStatusSnapshot | null
  localSavedPlansRevision: number | null
  localReportsRevision: number | null
  runtimeSnapshot: SyncRuntimeStatusSnapshot
  isOnline?: boolean | null
  nowMs?: number
  startupSyncHydrationCompletedAt?: number | null
  startupSyncHydrationPhase: StartupSyncHydrationPhase
  startupSyncHydrationSource?: StartupSyncHydrationSource
}
