import type { SyncRuntimeResource, SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'

export interface SyncStatusRuntimeResourceSummary {
  mode: SyncRuntimeStatusSnapshot[SyncRuntimeResource]['mode']
  pendingCount: number
  hasRemoteUpdates: boolean
  lastPull: string | null
  lastPush: string | null
  lastFailure: string | null
  failureReason: string | null
  retry: string | null
}
