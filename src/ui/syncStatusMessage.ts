import { buildSyncStatusMessageContext } from './syncStatusMessageContext'
import { ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE } from './issueReportSyncPresentation'
import { resolveSyncStatusDecision } from './syncStatusDecision'
import { buildSyncStatusResult } from './syncStatusResult'
import type {
  BuildSyncStatusMessageOptions,
  SyncStatusMessage,
  SyncStatusResourceSummary,
} from './syncStatusMessageTypes'

export type {
  BuildSyncStatusMessageOptions,
  SyncStatusMessage,
  SyncStatusResourceSummary,
}

export const buildSyncStatusMessage = ({
  hasSyncBaseUrl,
  hasSavedPlansEndpoint,
  hasReportsEndpoint,
  hasIssueReportsEndpoint = false,
  hasStatusEndpoint,
  statusError,
  statusErrorMessage = null,
  snapshot,
  localSavedPlansRevision,
  localReportsRevision,
  runtimeSnapshot,
  isOnline = null,
  nowMs = Date.now(),
  startupSyncHydrationCompletedAt = null,
  startupSyncHydrationPhase,
  startupSyncHydrationSource = null,
}: BuildSyncStatusMessageOptions): SyncStatusMessage => {
  const {
    degradationMessage,
    detail,
    applyOfflineKind,
    applyOfflineMessage,
    sharedResultFields,
    hasSavedPlanUpdates,
    hasReportUpdates,
  } = buildSyncStatusMessageContext({
    hasSyncBaseUrl,
    hasSavedPlansEndpoint,
    hasReportsEndpoint,
    hasStatusEndpoint,
    statusError,
    snapshot,
    localSavedPlansRevision,
    localReportsRevision,
    runtimeSnapshot,
    isOnline,
    nowMs,
    startupSyncHydrationCompletedAt,
    startupSyncHydrationPhase,
    startupSyncHydrationSource,
  })

  const decision = resolveSyncStatusDecision(
    {
      hasSyncBaseUrl,
      hasSavedPlansEndpoint,
      hasReportsEndpoint,
      hasIssueReportsEndpoint,
      hasStatusEndpoint,
      statusError,
      statusErrorMessage,
      snapshot,
      startupSyncHydrationPhase,
      startupSyncHydrationSource,
    },
    {
      degradationMessage,
      detail,
      applyOfflineKind,
      applyOfflineMessage,
      hasSavedPlanUpdates,
      hasReportUpdates,
    },
  )

  if (!hasSyncBaseUrl && !hasSavedPlansEndpoint && !hasReportsEndpoint) {
    const generalDiagnostics = hasIssueReportsEndpoint
      ? [...sharedResultFields.generalDiagnostics, ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE]
      : sharedResultFields.generalDiagnostics
    const diagnostics = hasIssueReportsEndpoint
      ? [...sharedResultFields.diagnostics, ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE]
      : sharedResultFields.diagnostics

    return buildSyncStatusResult(
      {
        ...sharedResultFields,
        diagnostics,
        generalDiagnostics,
        remoteUpdateResources: [],
        canRetryWrites: false,
        nextRetryAt: null,
        retryableResources: [],
      },
      decision,
    )
  }

  return buildSyncStatusResult(sharedResultFields, decision)
}
