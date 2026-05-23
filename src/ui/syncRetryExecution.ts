import {
  saveSavedPlans,
  type SaveSavedPlansResult,
  type SavedPlansPersistenceConfig,
} from '../api/savedPlansPersistence'
import {
  retryReportsSync,
  type ReportSyncConfig,
  type RetryReportsSyncResult,
} from '../feedback/reports'
import { type SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type {
  SavedPlan,
  SavedPlanConflictDetail,
} from './savedPlanTypes'
import {
  applySavedPlanConflictState,
} from './savedPlanConflictState'
import {
  buildRetrySyncOutcomeStatus,
  buildRetrySyncSuccessStatus,
} from './syncActionMessages'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface RetrySyncResourcesOptions {
  activeResources: SyncRuntimeResource[]
  savedPlans: SavedPlan[]
  savedPlansConfig: SavedPlansPersistenceConfig
  reportsConfig: ReportSyncConfig
  saveSavedPlansFn?: typeof saveSavedPlans
  retryReportsSyncFn?: typeof retryReportsSync
}

export interface RetrySyncResourcesResult {
  savedPlansResult: SaveSavedPlansResult | null
  reportRetryResult: RetryReportsSyncResult | null
}

interface ApplyRetrySavedPlansResultOptions {
  result: SaveSavedPlansResult
  setSavedPlans: (plans: SavedPlan[]) => void
  mergeSavedPlanConflictUrls: (urls: string[]) => void
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (details: SavedPlanConflictDetail[]) => void
}

export const retrySyncResources = async ({
  activeResources,
  savedPlans,
  savedPlansConfig,
  reportsConfig,
  saveSavedPlansFn = saveSavedPlans,
  retryReportsSyncFn = retryReportsSync,
}: RetrySyncResourcesOptions): Promise<RetrySyncResourcesResult> => {
  const savedPlansResult =
    savedPlansConfig.endpoint && activeResources.includes('savedPlans')
      ? await saveSavedPlansFn(savedPlans, {
          config: savedPlansConfig,
        })
      : null

  const reportRetryResult =
    reportsConfig.endpoint && activeResources.includes('reports')
      ? await retryReportsSyncFn({
          config: reportsConfig,
        })
      : null

  return {
    savedPlansResult,
    reportRetryResult,
  }
}

export const applyRetrySavedPlansResult = ({
  result,
  setSavedPlans,
  mergeSavedPlanConflictUrls,
  mergeSavedPlanConflictDetails,
  mergeSavedPlanConflictSharedPlans,
}: ApplyRetrySavedPlansResultOptions) => {
  setSavedPlans(result.plans)
  applySavedPlanConflictState({
    conflictedUrls: result.conflictedUrls,
    conflictDetails: result.conflictDetails,
    mergeSavedPlanConflictUrls,
    mergeSavedPlanConflictDetails,
    mergeSavedPlanConflictSharedPlans,
  })
}

export const buildRetrySyncResultStatus = ({
  activeResources,
  savedPlansResult,
  reportRetryResult,
}: RetrySyncResourcesResult & {
  activeResources: SyncRuntimeResource[]
}): TripBoardActionStatus => {
  if (
    (savedPlansResult === null || savedPlansResult.remoteSynced) &&
    (reportRetryResult === null || reportRetryResult.remoteSynced)
  ) {
    return buildRetrySyncSuccessStatus(activeResources)
  }

  return buildRetrySyncOutcomeStatus({
    ...(savedPlansResult ? { savedPlans: savedPlansResult.remoteSynced } : {}),
    ...(reportRetryResult ? { reports: reportRetryResult.remoteSynced } : {}),
  })
}
