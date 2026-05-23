import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadSyncStatus,
  type SyncStatusConfig,
  type SyncStatusSnapshot,
} from '../api/syncStatus'
import { useBrowserResumeEvents } from './useBrowserResumeEvents'
import {
  shouldApplySyncStatusSnapshot,
  shouldIgnoreSyncStatusError,
  shouldRefreshSyncStatus,
  type SyncStatusRefreshTrigger,
  SYNC_STATUS_POLL_MS,
} from './syncStatusPolling'

interface UseSyncStatusRefreshOptions {
  statusConfig: SyncStatusConfig
  isOnline: boolean | null
  onResume: () => void
}

export const useSyncStatusRefresh = ({
  statusConfig,
  isOnline,
  onResume,
}: UseSyncStatusRefreshOptions) => {
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [statusErrorMessage, setStatusErrorMessage] = useState<string | null>(
    null,
  )
  const refreshInFlightRef = useRef(false)
  const lastEventRefreshAtRef = useRef(0)
  const refreshRequestIdRef = useRef(0)
  const activeRefreshAbortControllerRef = useRef<AbortController | null>(null)

  const handleOffline = useCallback(() => {
    activeRefreshAbortControllerRef.current?.abort()
    activeRefreshAbortControllerRef.current = null
    refreshInFlightRef.current = false
    setStatusError(false)
    setStatusErrorMessage(null)
  }, [])

  const refreshStatus = useCallback(async (
    trigger: SyncStatusRefreshTrigger,
  ) => {
    const now = Date.now()
    if (
      !shouldRefreshSyncStatus({
        hasStatusEndpoint: Boolean(statusConfig.endpoint),
        isOnline,
        trigger,
        refreshInFlight: refreshInFlightRef.current,
        nowMs: now,
        lastEventRefreshAt: lastEventRefreshAtRef.current,
      })
    ) {
      if (isOnline === false) {
        setStatusError(false)
        setStatusErrorMessage(null)
      }
      return
    }

    if (trigger === 'event') {
      lastEventRefreshAtRef.current = now
    }

    if (!statusConfig.endpoint) {
      setStatusError(false)
      setStatusErrorMessage(null)
      return
    }

    refreshInFlightRef.current = true
    const requestId = refreshRequestIdRef.current + 1
    refreshRequestIdRef.current = requestId
    activeRefreshAbortControllerRef.current?.abort()
    const abortController = new AbortController()
    activeRefreshAbortControllerRef.current = abortController

    try {
      const nextSnapshot = await loadSyncStatus({
        config: statusConfig,
        signal: abortController.signal,
      })
      if (
        !shouldApplySyncStatusSnapshot({
          requestId,
          activeRequestId: refreshRequestIdRef.current,
          aborted: abortController.signal.aborted,
          snapshot: nextSnapshot,
        })
      ) {
        return
      }
      setSnapshot(nextSnapshot)
      setStatusError(false)
      setStatusErrorMessage(null)
    } catch (error) {
      if (
        shouldIgnoreSyncStatusError({
          requestId,
          activeRequestId: refreshRequestIdRef.current,
          aborted: abortController.signal.aborted,
          error,
        })
      ) {
        return
      }
      setStatusError(true)
      setStatusErrorMessage(error instanceof Error ? error.message : null)
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        refreshInFlightRef.current = false
      }
      if (activeRefreshAbortControllerRef.current === abortController) {
        activeRefreshAbortControllerRef.current = null
      }
    }
  }, [isOnline, statusConfig])

  useEffect(() => {
    if (!statusConfig.endpoint) {
      return
    }

    void refreshStatus('initial')

    const timerId =
      isOnline === false
        ? null
        : window.setInterval(() => {
            void refreshStatus('poll')
          }, SYNC_STATUS_POLL_MS)

    return () => {
      activeRefreshAbortControllerRef.current?.abort()
      activeRefreshAbortControllerRef.current = null
      refreshInFlightRef.current = false
      if (timerId !== null) {
        window.clearInterval(timerId)
      }
    }
  }, [isOnline, refreshStatus, statusConfig.endpoint])

  useBrowserResumeEvents({
    enabled: Boolean(statusConfig.endpoint),
    onResume: () => {
      onResume()
      void refreshStatus('event')
    },
  })

  return {
    snapshot,
    statusError,
    statusErrorMessage,
    handleOffline,
  }
}
