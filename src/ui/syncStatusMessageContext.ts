import {
  buildOfflineSyncAppliers,
  buildSyncStatusSharedFields,
} from './syncStatusSharedFields'
import type { SyncStatusSharedResultFields } from './syncStatusResult'
import type {
  BuildSyncStatusMessageOptions,
  SyncStatusMessage,
} from './syncStatusMessageTypes'

export interface SyncStatusMessageContext {
  applyOfflineKind: (kind: SyncStatusMessage['kind']) => SyncStatusMessage['kind']
  applyOfflineMessage: (message: string) => string
  degradationMessage: string | null
  detail: string | null
  hasReportUpdates: boolean
  hasSavedPlanUpdates: boolean
  sharedResultFields: SyncStatusSharedResultFields
}

export const buildSyncStatusMessageContext = ({
  snapshot,
  localSavedPlansRevision,
  localReportsRevision,
  runtimeSnapshot,
  isOnline = null,
  nowMs = Date.now(),
  startupSyncHydrationCompletedAt = null,
  startupSyncHydrationPhase,
  startupSyncHydrationSource = null,
}: BuildSyncStatusMessageOptions): SyncStatusMessageContext => {
  const { offlineNotice, applyOfflineKind, applyOfflineMessage } =
    buildOfflineSyncAppliers(isOnline)
  const {
    degradationMessage,
    detail,
    hasSavedPlanUpdates,
    hasReportUpdates,
    sharedResultFields,
  } = buildSyncStatusSharedFields({
    snapshot,
    localSavedPlansRevision,
    localReportsRevision,
    runtimeSnapshot,
    nowMs,
    startupSyncHydrationCompletedAt,
    startupSyncHydrationPhase,
    startupSyncHydrationSource,
    offlineNotice,
  })

  return {
    applyOfflineKind,
    applyOfflineMessage,
    degradationMessage,
    detail,
    hasSavedPlanUpdates,
    hasReportUpdates,
    sharedResultFields,
  }
}
