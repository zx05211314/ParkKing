import type { SyncStatusMessage } from './syncStatusMessage'

export const DEFAULT_EVENT_DRIVEN_SYNC_RECOVERY_COOLDOWN_MS = 3000

interface ShouldAutoRefreshRemoteUpdateOptions {
  syncKind: SyncStatusMessage['kind']
  remoteUpdateKey: string | null
  lastAutoRefreshKey: string | null
}

interface ShouldRunEventDrivenSyncRecoveryOptions {
  syncKind: SyncStatusMessage['kind']
  isOnline: boolean | null
  recoveryInFlight: boolean
  nowMs: number
  lastRecoveryAt: number
  cooldownMs?: number
}

export const shouldAutoRefreshRemoteUpdate = ({
  syncKind,
  remoteUpdateKey,
  lastAutoRefreshKey,
}: ShouldAutoRefreshRemoteUpdateOptions) =>
  syncKind === 'warning' &&
  remoteUpdateKey !== null &&
  remoteUpdateKey !== lastAutoRefreshKey

export const resolveSyncRetryDelayMs = (
  nextRetryAt: number | null,
  nowMs = Date.now(),
) => (nextRetryAt === null ? 0 : Math.max(0, nextRetryAt - nowMs))

export const shouldRunEventDrivenSyncRecovery = ({
  syncKind,
  isOnline,
  recoveryInFlight,
  nowMs,
  lastRecoveryAt,
  cooldownMs = DEFAULT_EVENT_DRIVEN_SYNC_RECOVERY_COOLDOWN_MS,
}: ShouldRunEventDrivenSyncRecoveryOptions) =>
  syncKind !== 'local' &&
  isOnline !== false &&
  !recoveryInFlight &&
  nowMs - lastRecoveryAt >= cooldownMs
