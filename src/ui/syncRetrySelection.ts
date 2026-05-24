import type {
  SyncRuntimeResource,
  SyncRuntimeStatusSnapshot,
} from '../api/syncRuntimeStatus'

export const listPendingRetryResources = (
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
) =>
  (Object.entries(runtimeSnapshot) as Array<
    [SyncRuntimeResource, { pendingCount: number }]
  >)
    .filter(([, status]) => status.pendingCount > 0)
    .map(([resource]) => resource)

export const listDueRetryResources = (
  runtimeSnapshot: SyncRuntimeStatusSnapshot,
  nowMs = Date.now(),
) =>
  (Object.entries(runtimeSnapshot) as Array<
    [SyncRuntimeResource, { pendingCount: number; nextRetryAt: number | null }]
  >)
    .filter(
      ([, status]) =>
        status.pendingCount > 0 &&
        (status.nextRetryAt === null || status.nextRetryAt <= nowMs),
    )
    .map(([resource]) => resource)

interface ResolveRetrySyncResourcesOptions {
  runtimeSnapshot: SyncRuntimeStatusSnapshot
  requestedResources?: SyncRuntimeResource[]
  retryingResources: Record<SyncRuntimeResource, boolean>
  endpointEnabled: Partial<Record<SyncRuntimeResource, boolean>>
  nowMs?: number
}

export const resolveRetrySyncResources = ({
  runtimeSnapshot,
  requestedResources,
  retryingResources,
  endpointEnabled,
  nowMs = Date.now(),
}: ResolveRetrySyncResourcesOptions) => {
  const requestedResourceSet = new Set(
    requestedResources ?? listDueRetryResources(runtimeSnapshot, nowMs),
  )

  return (['savedPlans', 'reports', 'issueReports'] as SyncRuntimeResource[]).filter(
    (resource) =>
      requestedResourceSet.has(resource) &&
      !retryingResources[resource] &&
      endpointEnabled[resource] === true,
  )
}
