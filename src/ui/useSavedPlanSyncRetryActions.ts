import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  getSyncRuntimeStatusSnapshot,
  noteSyncRuntimeRetryAttempt,
  type SyncRuntimeResource,
} from '../api/syncRuntimeStatus'
import { resolveSavedPlansPersistenceConfig } from '../api/savedPlansPersistence'
import { resolveReportSyncConfig } from '../feedback/reports'
import { resolveIssueReportSyncConfig } from '../feedback/issueReports'
import type { SavedPlanConflictDetail, SavedPlan } from './savedPlanTypes'
import {
  applyRetrySavedPlansResult,
  buildRetrySyncResultStatus,
  retrySyncResources,
} from './syncRetryExecution'
import { runSyncActionWithResourceState } from './syncActionRunner'
import {
  listPendingRetryResources,
  resolveRetrySyncResources,
} from './syncRetrySelection'
import { useSyncActionCallbacks } from './useSyncActionCallbacks'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import { useSyncResourceActivityState } from './useSyncResourceActivityState'

interface UseSavedPlanSyncRetryActionsOptions {
  savedPlans: SavedPlan[]
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (details: SavedPlanConflictDetail[]) => void
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

interface UseSavedPlanSyncRetryActionsResult {
  handleAutoRetrySyncWrites: () => Promise<void>
  handleAutoRetrySyncWritesNow: () => Promise<void>
  handleRetryResourceSync: (resource: SyncRuntimeResource) => Promise<void>
  handleRetrySyncWrites: () => Promise<void>
  retryingResources: Record<SyncRuntimeResource, boolean>
}

export const useSavedPlanSyncRetryActions = ({
  savedPlans,
  mergeSavedPlanConflictDetails,
  mergeSavedPlanConflictSharedPlans,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
}: UseSavedPlanSyncRetryActionsOptions): UseSavedPlanSyncRetryActionsResult => {
  const {
    resourceState: retryingResources,
    resourceStateRef: retryingResourcesRef,
    setResourceState: setRetryingState,
  } = useSyncResourceActivityState()

  const runRetrySyncWrites = useCallback(
    async (silent: boolean, resources?: SyncRuntimeResource[]) => {
      const runtimeSnapshot = getSyncRuntimeStatusSnapshot()
      const savedPlansConfig = resolveSavedPlansPersistenceConfig()
      const reportsConfig = resolveReportSyncConfig()
      const issueReportsConfig = resolveIssueReportSyncConfig()
      const activeResources = resolveRetrySyncResources({
        runtimeSnapshot,
        requestedResources: resources,
        retryingResources: retryingResourcesRef.current,
        endpointEnabled: {
          savedPlans: Boolean(savedPlansConfig.endpoint),
          reports: Boolean(reportsConfig.endpoint),
          issueReports: Boolean(issueReportsConfig.endpoint),
        },
      })

      await runSyncActionWithResourceState({
        activeResources,
        silent,
        setResourceState: setRetryingState,
        setShareStatus,
        fallbackErrorMessage: 'Retried sync failed.',
        onStart: (resourcesToRetry) => {
          resourcesToRetry.forEach((resource) => {
            noteSyncRuntimeRetryAttempt(resource, {
              source: silent ? 'auto' : 'manual',
            })
          })
        },
        action: async () => {
          const {
            savedPlansResult,
            reportRetryResult,
            issueReportRetryResult,
          } = await retrySyncResources({
            activeResources,
            savedPlans,
            savedPlansConfig,
            reportsConfig,
            issueReportsConfig,
          })

          if (savedPlansResult) {
            applyRetrySavedPlansResult({
              result: savedPlansResult,
              setSavedPlans,
              mergeSavedPlanConflictUrls: (urls) => {
                setSavedPlanConflictUrls((currentConflictUrls) =>
                  Array.from(new Set([...currentConflictUrls, ...urls])),
                )
              },
              mergeSavedPlanConflictDetails,
              mergeSavedPlanConflictSharedPlans,
            })
          }

          return buildRetrySyncResultStatus({
            activeResources,
            savedPlansResult,
            reportRetryResult,
            issueReportRetryResult,
          })
        },
      })
    },
    [
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
      retryingResourcesRef,
      setRetryingState,
      setSavedPlanConflictUrls,
      setSavedPlans,
      setShareStatus,
      savedPlans,
    ],
  )
  const {
    handleAutoAction: handleAutoRetrySyncWrites,
    handleManualAction: handleRetrySyncWrites,
    handleManualResourceAction: handleRetryResourceSync,
  } = useSyncActionCallbacks({
    runAction: runRetrySyncWrites,
  })

  const handleAutoRetrySyncWritesNow = useCallback(async () => {
    const pendingResources = listPendingRetryResources(
      getSyncRuntimeStatusSnapshot(),
    )

    if (pendingResources.length === 0) {
      return
    }

    await runRetrySyncWrites(true, pendingResources)
  }, [runRetrySyncWrites])

  return {
    handleAutoRetrySyncWrites,
    handleAutoRetrySyncWritesNow,
    handleRetryResourceSync,
    handleRetrySyncWrites,
    retryingResources,
  }
}
