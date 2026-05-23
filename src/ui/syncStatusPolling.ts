import type { SyncStatusSnapshot } from '../api/syncStatus'

export const SYNC_STATUS_POLL_MS = 30000
export const SYNC_STATUS_CLOCK_MS = 60000
export const SYNC_STATUS_EVENT_REFRESH_COOLDOWN_MS = 3000

export type SyncStatusRefreshTrigger = 'initial' | 'event' | 'poll'

interface ShouldRefreshSyncStatusOptions {
  hasStatusEndpoint: boolean
  isOnline: boolean | null
  trigger: SyncStatusRefreshTrigger
  refreshInFlight: boolean
  nowMs: number
  lastEventRefreshAt: number
  cooldownMs?: number
}

interface SyncStatusRequestGuardOptions {
  requestId: number
  activeRequestId: number
  aborted: boolean
}

interface ShouldApplySyncStatusSnapshotOptions
  extends SyncStatusRequestGuardOptions {
  snapshot: SyncStatusSnapshot | null
}

interface ShouldIgnoreSyncStatusErrorOptions
  extends SyncStatusRequestGuardOptions {
  error: unknown
}

export const shouldRefreshSyncStatus = ({
  hasStatusEndpoint,
  isOnline,
  trigger,
  refreshInFlight,
  nowMs,
  lastEventRefreshAt,
  cooldownMs = SYNC_STATUS_EVENT_REFRESH_COOLDOWN_MS,
}: ShouldRefreshSyncStatusOptions) => {
  if (!hasStatusEndpoint || isOnline === false || refreshInFlight) {
    return false
  }

  return (
    trigger !== 'event' || nowMs - lastEventRefreshAt >= cooldownMs
  )
}

export const resolveSyncStatusClockBoundaryDelay = (
  nowMs: number,
  clockMs = SYNC_STATUS_CLOCK_MS,
) => {
  const normalizedClockMs =
    Number.isFinite(clockMs) && clockMs > 0
      ? Math.floor(clockMs)
      : SYNC_STATUS_CLOCK_MS
  const remainder = nowMs % normalizedClockMs
  return remainder === 0
    ? normalizedClockMs
    : normalizedClockMs - remainder
}

export const isCurrentSyncStatusRequest = ({
  requestId,
  activeRequestId,
  aborted,
}: SyncStatusRequestGuardOptions) => !aborted && requestId === activeRequestId

export const shouldApplySyncStatusSnapshot = ({
  requestId,
  activeRequestId,
  aborted,
  snapshot,
}: ShouldApplySyncStatusSnapshotOptions) =>
  snapshot !== null &&
  isCurrentSyncStatusRequest({
    requestId,
    activeRequestId,
    aborted,
  })

export const shouldIgnoreSyncStatusError = ({
  requestId,
  activeRequestId,
  aborted,
  error,
}: ShouldIgnoreSyncStatusErrorOptions) =>
  !isCurrentSyncStatusRequest({
    requestId,
    activeRequestId,
    aborted,
  }) || (error instanceof Error && error.name === 'AbortError')
