import type { Dispatch, SetStateAction } from 'react'
import { type SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import { useSavedPlanSyncConflictActions } from './useSavedPlanSyncConflictActions'
import { useSavedPlanSyncRefreshActions } from './useSavedPlanSyncRefreshActions'
import { useSavedPlanSyncRetryActions } from './useSavedPlanSyncRetryActions'

interface UseSavedPlanSyncActionsOptions {
  savedPlans: SavedPlan[]
  savedPlanLimit: number
  setReportVersion: Dispatch<SetStateAction<number>>
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
}

export interface UseSavedPlanSyncActionsResult {
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  handleAutoRefreshSync: () => Promise<void>
  handleAutoRefreshSyncResources: (
    resources: SyncRuntimeResource[],
  ) => Promise<void>
  handleAutoRetrySyncWrites: () => Promise<void>
  handleAutoRetrySyncWritesNow: () => Promise<void>
  handleRefreshSync: () => Promise<void>
  handleRefreshResourceSync: (resource: SyncRuntimeResource) => Promise<void>
  handleRetryResourceSync: (resource: SyncRuntimeResource) => Promise<void>
  handleRetrySyncWrites: () => Promise<void>
  isRefreshingSync: boolean
  refreshingResources: Record<SyncRuntimeResource, boolean>
  retryingResources: Record<SyncRuntimeResource, boolean>
}

export const useSavedPlanSyncActions = ({
  savedPlans,
  savedPlanLimit,
  setReportVersion,
  setSavedPlanConflictDetailsByUrl,
  setSavedPlanConflictSharedByUrl,
  setSavedPlanConflictUrls,
  setSavedPlans,
  setShareStatus,
}: UseSavedPlanSyncActionsOptions): UseSavedPlanSyncActionsResult => {
  const {
    clearSavedPlanConflictsForUrls,
    mergeSavedPlanConflictDetails,
    mergeSavedPlanConflictSharedPlans,
  } = useSavedPlanSyncConflictActions({
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
  })

  const {
    handleAutoRefreshSync,
    handleAutoRefreshSyncResources,
    handleRefreshSync,
    handleRefreshResourceSync,
    isRefreshingSync,
    refreshingResources,
  } = useSavedPlanSyncRefreshActions({
    savedPlanLimit,
    mergeSavedPlanConflictDetails,
    mergeSavedPlanConflictSharedPlans,
    setReportVersion,
    setSavedPlanConflictUrls,
    setSavedPlans,
    setShareStatus,
  })
  const {
    handleAutoRetrySyncWrites,
    handleAutoRetrySyncWritesNow,
    handleRetryResourceSync,
    handleRetrySyncWrites,
    retryingResources,
  } = useSavedPlanSyncRetryActions({
    savedPlans,
    mergeSavedPlanConflictDetails,
    mergeSavedPlanConflictSharedPlans,
    setSavedPlanConflictUrls,
    setSavedPlans,
    setShareStatus,
  })

  return {
    clearSavedPlanConflictsForUrls,
    handleAutoRefreshSync,
    handleAutoRefreshSyncResources,
    handleAutoRetrySyncWrites,
    handleAutoRetrySyncWritesNow,
    handleRefreshSync,
    handleRefreshResourceSync,
    handleRetryResourceSync,
    handleRetrySyncWrites,
    isRefreshingSync,
    refreshingResources,
    retryingResources,
  }
}
