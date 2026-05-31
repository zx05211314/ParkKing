import {
  buildWaitingSyncMessage,
  describeRemoteUpdateTarget,
} from './syncStatusResult'
import type { SyncStatusMessageContext } from './syncStatusMessageContext'
import type {
  BuildSyncStatusMessageOptions,
  SyncStatusMessage,
} from './syncStatusMessageTypes'

type SyncStatusDecision = Pick<
  SyncStatusMessage,
  'kind' | 'message' | 'detail' | 'syncScope' | 'remoteUpdateKey'
>

const normalizeStatusErrorMessage = (message: string | null | undefined) => {
  if (typeof message !== 'string') {
    return null
  }
  const trimmed = message.trim()
  return trimmed.length > 0 ? trimmed : null
}

const ensureSentence = (message: string) =>
  /[.!?]$/.test(message) ? message : `${message}.`

export const buildSyncStatusErrorMessage = (
  statusErrorMessage: string | null | undefined,
  degradationMessage: string | null,
) => {
  const normalizedStatusErrorMessage =
    normalizeStatusErrorMessage(statusErrorMessage)
  if (normalizedStatusErrorMessage) {
    const parts = [ensureSentence(normalizedStatusErrorMessage)]
    if (degradationMessage) {
      parts.push(ensureSentence(degradationMessage))
    }
    parts.push('Local data stays unchanged.')
    return parts.join(' ')
  }

  return degradationMessage
    ? `Sync status is unavailable. ${degradationMessage} Local data stays unchanged.`
    : 'Sync status is unavailable. Local data stays unchanged.'
}

export const resolveSyncStatusDecision = (
  {
    hasSyncBaseUrl,
    hasSavedPlansEndpoint,
    hasReportsEndpoint,
    hasIssueReportsEndpoint = false,
    hasStatusEndpoint,
    statusError,
    statusErrorMessage = null,
    snapshot,
    startupSyncHydrationPhase,
    startupSyncHydrationSource = null,
  }: Pick<
    BuildSyncStatusMessageOptions,
    | 'hasSyncBaseUrl'
    | 'hasSavedPlansEndpoint'
    | 'hasReportsEndpoint'
    | 'hasIssueReportsEndpoint'
    | 'hasStatusEndpoint'
    | 'statusError'
    | 'statusErrorMessage'
    | 'snapshot'
    | 'startupSyncHydrationPhase'
    | 'startupSyncHydrationSource'
  >,
  {
    degradationMessage,
    detail,
    applyOfflineKind,
    applyOfflineMessage,
    hasSavedPlanUpdates,
    hasReportUpdates,
  }: Pick<
    SyncStatusMessageContext,
    | 'degradationMessage'
    | 'detail'
    | 'applyOfflineKind'
    | 'applyOfflineMessage'
    | 'hasSavedPlanUpdates'
    | 'hasReportUpdates'
  >,
): SyncStatusDecision => {
  if (!hasSyncBaseUrl && !hasSavedPlansEndpoint && !hasReportsEndpoint) {
    return {
      kind: 'local',
      message: hasIssueReportsEndpoint
        ? 'Shared sync is local-only in this session. Issue reports can still upload from this device.'
        : 'Sync is local-only in this session.',
      detail: null,
      syncScope: null,
      remoteUpdateKey: null,
    }
  }

  if (!hasStatusEndpoint) {
    return {
      kind: applyOfflineKind(degradationMessage ? 'warning' : 'success'),
      message: applyOfflineMessage(
        degradationMessage
          ? `Legacy sync is connected. ${degradationMessage}`
          : 'Legacy sync is connected, but remote status is unavailable.',
      ),
      detail,
      syncScope: snapshot?.scope ?? null,
      remoteUpdateKey: null,
    }
  }

  if (statusError) {
    return {
      kind: 'error',
      message: applyOfflineMessage(
        buildSyncStatusErrorMessage(statusErrorMessage, degradationMessage),
      ),
      detail,
      syncScope: snapshot?.scope ?? null,
      remoteUpdateKey: null,
    }
  }

  if (!snapshot) {
    return {
      kind: applyOfflineKind(degradationMessage ? 'warning' : 'success'),
      message: applyOfflineMessage(
        buildWaitingSyncMessage({
          degradationMessage,
          startupSyncHydrationPhase,
          startupSyncHydrationSource,
        }),
      ),
      detail: null,
      syncScope: null,
      remoteUpdateKey: null,
    }
  }

  if (hasSavedPlanUpdates || hasReportUpdates) {
    return {
      kind: 'warning',
      message: applyOfflineMessage(
        degradationMessage
          ? `Remote updates are available for ${describeRemoteUpdateTarget(
              hasSavedPlanUpdates,
              hasReportUpdates,
            )}. ${degradationMessage}`
          : `Remote updates are available for ${describeRemoteUpdateTarget(
              hasSavedPlanUpdates,
              hasReportUpdates,
            )}. Pulling the newest shared data.`,
      ),
      detail,
      syncScope: snapshot.scope,
      remoteUpdateKey: `${snapshot.savedPlansRevision}:${snapshot.reportsRevision}`,
    }
  }

  if (degradationMessage) {
    return {
      kind: 'warning',
      message: applyOfflineMessage(`Sync connected. ${degradationMessage}`),
      detail,
      syncScope: snapshot.scope,
      remoteUpdateKey: null,
    }
  }

  return {
    kind: applyOfflineKind('success'),
    message: applyOfflineMessage(
      `Sync connected. Scope has ${snapshot.savedPlansCount} saved plans and ${snapshot.reportsCount} reports.`,
    ),
    detail,
    syncScope: snapshot.scope,
    remoteUpdateKey: null,
  }
}
