import { useCallback, useEffect, useMemo, useRef } from 'react'
import { getSavedPlansRevision } from '../api/savedPlansPersistence'
import { resolveSyncStatusConfig } from '../api/syncStatus'
import { getReportsRevision, resolveReportSyncConfig } from '../feedback/reports'
import { resolveSavedPlansPersistenceConfig } from '../api/savedPlansPersistence'
import { resolveParkKingSyncServiceConfig } from '../api/syncContract'
import { buildSyncStatusMessage } from './syncStatusMessage'
import type { SyncStatusMessage } from './syncStatusMessageTypes'
import { useBrowserOnlineState } from './useBrowserOnlineState'
import type {
  StartupSyncHydrationPhase,
  StartupSyncHydrationSource,
} from './startupSyncHydrationState'
import { useSyncRuntimeSnapshot } from './useSyncRuntimeSnapshot'
import { useSyncStatusClock } from './useSyncStatusClock'
import { useSyncStatusRefresh } from './useSyncStatusRefresh'

interface UseSyncStatusOptions {
  startupSyncHydrationCompletedAt: number | null
  startupSyncHydrationPhase: StartupSyncHydrationPhase
  startupSyncHydrationSource: StartupSyncHydrationSource
}

export const useSyncStatus = ({
  startupSyncHydrationCompletedAt,
  startupSyncHydrationPhase,
  startupSyncHydrationSource,
}: UseSyncStatusOptions): SyncStatusMessage => {
  const syncConfig = useMemo(() => resolveParkKingSyncServiceConfig(), [])
  const statusConfig = useMemo(() => resolveSyncStatusConfig(), [])
  const savedPlansConfig = useMemo(() => resolveSavedPlansPersistenceConfig(), [])
  const reportsConfig = useMemo(() => resolveReportSyncConfig(), [])
  const { nowMs, setNowMs } = useSyncStatusClock()
  const runtimeSnapshot = useSyncRuntimeSnapshot()
  const handleOfflineRef = useRef<() => void>(() => {})
  const handleBrowserOffline = useCallback(() => {
    handleOfflineRef.current()
  }, [])
  const isOnline = useBrowserOnlineState({
    onOffline: handleBrowserOffline,
  })
  const handleResume = useCallback(() => {
    setNowMs(Date.now())
  }, [setNowMs])
  const { snapshot, statusError, statusErrorMessage, handleOffline } =
    useSyncStatusRefresh({
      statusConfig,
      isOnline,
      onResume: handleResume,
    })

  useEffect(() => {
    handleOfflineRef.current = handleOffline
  }, [handleOffline])

  return buildSyncStatusMessage({
    hasSyncBaseUrl: Boolean(syncConfig.baseUrl),
    hasSavedPlansEndpoint: Boolean(savedPlansConfig.endpoint),
    hasReportsEndpoint: Boolean(reportsConfig.endpoint),
    hasIssueReportsEndpoint: Boolean(syncConfig.issueReportsEndpoint),
    hasStatusEndpoint: Boolean(statusConfig.endpoint),
    statusError,
    statusErrorMessage,
    snapshot,
    localSavedPlansRevision: getSavedPlansRevision(savedPlansConfig.endpoint),
    localReportsRevision: getReportsRevision(reportsConfig.endpoint),
    runtimeSnapshot,
    isOnline,
    nowMs,
    startupSyncHydrationCompletedAt,
    startupSyncHydrationPhase,
    startupSyncHydrationSource,
  })
}
