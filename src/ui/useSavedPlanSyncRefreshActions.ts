import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { type SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { SavedPlanConflictDetail, SavedPlan } from './savedPlanTypes'
import { buildRefreshSyncSuccessStatus } from './syncActionMessages'
import { runSyncActionWithResourceState } from './syncActionRunner'
import {
  loadSyncRefreshResources,
  normalizeSyncRefreshResources,
} from './syncRefreshTransport'
import {
  applySyncRefreshTransportResult,
} from './syncRefreshState'
import { useSyncActionCallbacks } from './useSyncActionCallbacks'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import { useSyncResourceActivityState } from './useSyncResourceActivityState'

interface UseSavedPlanSyncRefreshActionsOptions {
  savedPlanLimit: number
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (details: SavedPlanConflictDetail[]) => void
  setReportVersion: Dispatch<SetStateAction<number>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

interface UseSavedPlanSyncRefreshActionsResult {
  handleAutoRefreshSync: () => Promise<void>
  handleAutoRefreshSyncResources: (
    resources: SyncRuntimeResource[],
  ) => Promise<void>
  handleRefreshSync: () => Promise<void>
  handleRefreshResourceSync: (resource: SyncRuntimeResource) => Promise<void>
  isRefreshingSync: boolean
  refreshingResources: Record<SyncRuntimeResource, boolean>
}

export const useSavedPlanSyncRefreshActions = ({
  savedPlanLimit,
  mergeSavedPlanConflictDetails,
  mergeSavedPlanConflictSharedPlans,
  setReportVersion,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
}: UseSavedPlanSyncRefreshActionsOptions): UseSavedPlanSyncRefreshActionsResult => {
  const [isRefreshingSync, setIsRefreshingSync] = useState(false)
  const refreshSyncInFlightRef = useRef(false)
  const {
    resourceState: refreshingResources,
    setResourceState: setRefreshingState,
  } = useSyncResourceActivityState()

  const runRefreshSync = useCallback(
    async (silent: boolean, resources?: SyncRuntimeResource[]) => {
      const activeResources = normalizeSyncRefreshResources(resources)
      await runSyncActionWithResourceState({
        activeResources,
        silent,
        setResourceState: setRefreshingState,
        setShareStatus,
        fallbackErrorMessage: 'Shared sync refresh failed.',
        setBusyState: setIsRefreshingSync,
        inFlightRef: refreshSyncInFlightRef,
        action: async () => {
          const refreshTransportResult = await loadSyncRefreshResources({
            resources: activeResources,
          })

          applySyncRefreshTransportResult({
            transportResult: refreshTransportResult,
            savedPlanLimit,
            setReportVersion,
            setSavedPlanConflictUrls,
            setSavedPlans,
            mergeSavedPlanConflictDetails,
            mergeSavedPlanConflictSharedPlans,
          })

          return buildRefreshSyncSuccessStatus(activeResources)
        },
      })
    },
    [
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
      savedPlanLimit,
      setIsRefreshingSync,
      setRefreshingState,
      setReportVersion,
      setSavedPlanConflictUrls,
      setSavedPlans,
      setShareStatus,
    ],
  )
  const {
    handleAutoAction: handleAutoRefreshSync,
    handleAutoResourcesAction: handleAutoRefreshSyncResources,
    handleManualAction: handleRefreshSync,
    handleManualResourceAction: handleRefreshResourceSync,
  } = useSyncActionCallbacks({
    runAction: runRefreshSync,
  })

  return {
    handleAutoRefreshSync,
    handleAutoRefreshSyncResources,
    handleRefreshSync,
    handleRefreshResourceSync,
    isRefreshingSync,
    refreshingResources,
  }
}
