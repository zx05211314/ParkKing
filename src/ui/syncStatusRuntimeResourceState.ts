import type { SyncRuntimeResource, SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'
import type { SyncStatusSnapshot } from '../api/syncStatus'
import {
  SYNC_STATUS_RESOURCE_LABELS,
  capitalizeSentence,
} from './syncStatusRuntimeFormatting'

const listRuntimeResources = (
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
  mode: SyncRuntimeStatusSnapshot[SyncRuntimeResource]['mode'],
) =>
  (Object.entries(runtimeSnapshot) as Array<
    [SyncRuntimeResource, SyncRuntimeStatusSnapshot[SyncRuntimeResource]]
  >)
    .filter(([, status]) => status.mode === mode)
    .map(([resource]) => SYNC_STATUS_RESOURCE_LABELS[resource])

export const listPendingRuntimeResourceKeys = (
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
) =>
  (Object.entries(runtimeSnapshot) as Array<
    [SyncRuntimeResource, SyncRuntimeStatusSnapshot[SyncRuntimeResource]]
  >)
    .filter(([, status]) => status.pendingCount > 0)
    .map(([resource]) => resource)

const formatResourceList = (items: string[]) => {
  if (items.length <= 1) {
    return items[0] ?? ''
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export const describeRuntimeDegradation = (
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
) => {
  const parts: string[] = []
  const syncingResources = listRuntimeResources(runtimeSnapshot, 'syncing')
  const fallbackResources = listRuntimeResources(runtimeSnapshot, 'fallback-local')
  const localOnlyResources = listRuntimeResources(runtimeSnapshot, 'local-only')
  const pendingResources = listPendingRuntimeResourceKeys(runtimeSnapshot)
    .filter((resource) => runtimeSnapshot[resource].mode === 'remote')
    .map((resource) => SYNC_STATUS_RESOURCE_LABELS[resource])

  if (syncingResources.length > 0) {
    parts.push(`${formatResourceList(syncingResources)} are waiting for remote confirmation`)
  }
  if (fallbackResources.length > 0) {
    parts.push(`${formatResourceList(fallbackResources)} are using local fallback`)
  }
  if (pendingResources.length > 0) {
    parts.push(`${formatResourceList(pendingResources)} still have pending local writes`)
  }
  if (localOnlyResources.length > 0) {
    parts.push(`${formatResourceList(localOnlyResources)} are local-only`)
  }

  if (parts.length === 0) {
    return null
  }

  return capitalizeSentence(`${parts.join('. ')}.`)
}

export const listRemoteUpdateResources = (
  snapshot: SyncStatusSnapshot | null,
  localSavedPlansRevision: number | null,
  localReportsRevision: number | null,
): SyncRuntimeResource[] => {
  if (!snapshot) {
    return []
  }

  const resources: SyncRuntimeResource[] = []
  if (
    localSavedPlansRevision !== null &&
    snapshot.savedPlansRevision > localSavedPlansRevision
  ) {
    resources.push('savedPlans')
  }
  if (
    localReportsRevision !== null &&
    snapshot.reportsRevision > localReportsRevision
  ) {
    resources.push('reports')
  }
  return resources
}
