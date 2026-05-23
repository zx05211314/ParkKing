import { useEffect, useRef } from 'react'
import type { SyncStatusMessage } from './syncStatusMessage'
import { useBrowserResumeEvents } from './useBrowserResumeEvents'
import {
  DEFAULT_EVENT_DRIVEN_SYNC_RECOVERY_COOLDOWN_MS,
  resolveSyncRetryDelayMs,
  shouldAutoRefreshRemoteUpdate,
  shouldRunEventDrivenSyncRecovery,
} from './syncRecovery'
import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'

interface UseSyncRecoveryEffectsOptions {
  syncStatus: SyncStatusMessage
  handleAutoRefreshSync: () => Promise<void>
  handleAutoRefreshSyncResources: (
    resources: SyncRuntimeResource[],
  ) => Promise<void>
  handleAutoRetrySyncWrites: () => Promise<void>
  handleAutoRetrySyncWritesNow: () => Promise<void>
}

export const useSyncRecoveryEffects = ({
  syncStatus,
  handleAutoRefreshSync,
  handleAutoRefreshSyncResources,
  handleAutoRetrySyncWrites,
  handleAutoRetrySyncWritesNow,
}: UseSyncRecoveryEffectsOptions) => {
  const lastAutoRefreshKeyRef = useRef<string | null>(null)
  const syncRecoveryInFlightRef = useRef(false)
  const lastSyncRecoveryAtRef = useRef(0)
  const startupHydrationReady =
    syncStatus.startupSyncHydrationPhase === 'ready'

  useEffect(() => {
    if (!startupHydrationReady) {
      return
    }
    if (!shouldAutoRefreshRemoteUpdate({
      syncKind: syncStatus.kind,
      remoteUpdateKey: syncStatus.remoteUpdateKey,
      lastAutoRefreshKey: lastAutoRefreshKeyRef.current,
    })) {
      return
    }
    lastAutoRefreshKeyRef.current = syncStatus.remoteUpdateKey
    void handleAutoRefreshSyncResources(syncStatus.remoteUpdateResources)
  }, [
    handleAutoRefreshSyncResources,
    startupHydrationReady,
    syncStatus.kind,
    syncStatus.remoteUpdateKey,
    syncStatus.remoteUpdateResources,
  ])

  useEffect(() => {
    if (!startupHydrationReady || !syncStatus.canRetryWrites) {
      return
    }

    let cancelled = false
    const delayMs = resolveSyncRetryDelayMs(syncStatus.nextRetryAt)
    const runRetry = async () => {
      if (cancelled) {
        return
      }
      await handleAutoRetrySyncWrites()
    }

    const timerId = window.setTimeout(() => {
      void runRetry()
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [
    handleAutoRetrySyncWrites,
    startupHydrationReady,
    syncStatus.canRetryWrites,
    syncStatus.nextRetryAt,
  ])

  useBrowserResumeEvents({
    enabled: syncStatus.kind !== 'local' && startupHydrationReady,
    onResume: () => {
      const now = Date.now()
      if (!shouldRunEventDrivenSyncRecovery({
        syncKind: syncStatus.kind,
        isOnline: typeof navigator === 'undefined' ? null : navigator.onLine,
        recoveryInFlight: syncRecoveryInFlightRef.current,
        nowMs: now,
        lastRecoveryAt: lastSyncRecoveryAtRef.current,
        cooldownMs: DEFAULT_EVENT_DRIVEN_SYNC_RECOVERY_COOLDOWN_MS,
      })) {
        return
      }

      syncRecoveryInFlightRef.current = true
      lastSyncRecoveryAtRef.current = now
      void (async () => {
        try {
          await handleAutoRefreshSync()
          await handleAutoRetrySyncWritesNow()
        } finally {
          syncRecoveryInFlightRef.current = false
          lastSyncRecoveryAtRef.current = Date.now()
        }
      })()
    },
  })
  useEffect(() => {
    if (syncStatus.kind === 'local' || !startupHydrationReady) {
      syncRecoveryInFlightRef.current = false
      lastSyncRecoveryAtRef.current = 0
    }
  }, [startupHydrationReady, syncStatus.kind])
}
