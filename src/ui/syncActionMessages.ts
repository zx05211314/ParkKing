import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

const SYNC_ACTION_RESOURCE_LABELS: Record<SyncRuntimeResource, string> = {
  savedPlans: 'saved plans',
  reports: 'reports',
  issueReports: 'issue reports',
}

const formatResourceLabels = (labels: string[]) => {
  if (labels.length <= 1) {
    return labels[0] ?? ''
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

export const describeSyncActionTarget = (resources: SyncRuntimeResource[]) =>
  resources.length === 1
    ? SYNC_ACTION_RESOURCE_LABELS[resources[0]]
    : 'shared data'

export const buildRefreshSyncSuccessStatus = (
  resources: SyncRuntimeResource[],
): TripBoardActionStatus => ({
  kind: 'success',
  message: `Pulled latest ${describeSyncActionTarget(resources)}.`,
})

export const buildRetrySyncSuccessStatus = (
  resources: SyncRuntimeResource[],
): TripBoardActionStatus => {
  const labels = resources.map((resource) => SYNC_ACTION_RESOURCE_LABELS[resource])
  return {
    kind: 'success',
    message:
      labels.length > 0
        ? `Retried sync. ${formatResourceLabels(labels)} are confirmed remotely.`
        : 'Retried sync.',
  }
}

export const buildRetrySyncOutcomeStatus = (
  remoteSyncedByResource: Partial<Record<SyncRuntimeResource, boolean>>,
): TripBoardActionStatus => {
  const outcomeParts = (Object.entries(remoteSyncedByResource) as Array<
    [SyncRuntimeResource, boolean]
  >).map(([resource, remoteSynced]) =>
    remoteSynced
      ? `${SYNC_ACTION_RESOURCE_LABELS[resource]} synced`
      : `${SYNC_ACTION_RESOURCE_LABELS[resource]} still using local fallback`,
  )

  return {
    kind: 'error',
    message: `Retried sync. ${outcomeParts.join('; ')}.`,
  }
}
