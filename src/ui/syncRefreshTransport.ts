import {
  fetchSyncBootstrapSnapshot,
  resolveSyncBootstrapConfig,
  type SyncBootstrapConfig,
} from '../api/syncBootstrap'
import {
  loadSavedPlans,
  resolveSavedPlansPersistenceConfig,
  type SavedPlansPersistenceConfig,
} from '../api/savedPlansPersistence'
import { type SyncRuntimeResource } from '../api/syncRuntimeStatus'
import {
  loadReports,
  resolveReportSyncConfig,
  type ReportSyncConfig,
  type SegmentReport,
} from '../feedback/reports'
import type { SavedPlan } from './savedPlanTypes'

export interface SyncRefreshRevisionTarget {
  endpoint: string
  revision: number
}

export interface SyncRefreshSavedPlansPayload {
  remoteSavedPlans: SavedPlan[]
  revisionTarget?: SyncRefreshRevisionTarget
}

export interface SyncRefreshReportsPayload {
  remoteReports: SegmentReport[]
  revisionTarget?: SyncRefreshRevisionTarget
}

export interface SyncRefreshTransportResult {
  savedPlans: SyncRefreshSavedPlansPayload | null
  reports: SyncRefreshReportsPayload | null
}

interface LoadSyncRefreshResourcesOptions {
  resources?: SyncRuntimeResource[]
  bootstrapConfig?: SyncBootstrapConfig
  savedPlansConfig?: SavedPlansPersistenceConfig
  reportsConfig?: ReportSyncConfig
  fetchSyncBootstrapSnapshotFn?: typeof fetchSyncBootstrapSnapshot
  loadSavedPlansFn?: typeof loadSavedPlans
  loadReportsFn?: typeof loadReports
}

const DEFAULT_SYNC_REFRESH_RESOURCES: SyncRuntimeResource[] = [
  'savedPlans',
  'reports',
]

export const normalizeSyncRefreshResources = (
  resources?: SyncRuntimeResource[],
) => {
  const normalizedResources = (resources ?? []).filter(
    (resource, index, allResources) =>
      (resource === 'savedPlans' || resource === 'reports') &&
      allResources.indexOf(resource) === index,
  )

  if (normalizedResources.length === 0) {
    return DEFAULT_SYNC_REFRESH_RESOURCES
  }

  return normalizedResources
}

const resolveRevisionTarget = (
  endpoint: string | null,
  revision: number | null,
): SyncRefreshRevisionTarget | undefined =>
  endpoint !== null && revision !== null ? { endpoint, revision } : undefined

export const loadSyncRefreshResources = async ({
  resources,
  bootstrapConfig = resolveSyncBootstrapConfig(),
  savedPlansConfig = resolveSavedPlansPersistenceConfig(),
  reportsConfig = resolveReportSyncConfig(),
  fetchSyncBootstrapSnapshotFn = fetchSyncBootstrapSnapshot,
  loadSavedPlansFn = loadSavedPlans,
  loadReportsFn = loadReports,
}: LoadSyncRefreshResourcesOptions = {}): Promise<SyncRefreshTransportResult> => {
  const activeResources = normalizeSyncRefreshResources(resources)

  if (bootstrapConfig.endpoint) {
    const snapshot = await fetchSyncBootstrapSnapshotFn({
      config: bootstrapConfig,
      resources: activeResources,
    })
    if (!snapshot) {
      throw new Error('Shared sync is unavailable.')
    }

    return {
      savedPlans: activeResources.includes('savedPlans')
        ? {
            remoteSavedPlans: snapshot.savedPlans,
            revisionTarget: resolveRevisionTarget(
              bootstrapConfig.savedPlansEndpoint,
              snapshot.savedPlansRevision,
            ),
          }
        : null,
      reports: activeResources.includes('reports')
        ? {
            remoteReports: snapshot.reports,
            revisionTarget: resolveRevisionTarget(
              bootstrapConfig.reportsEndpoint,
              snapshot.reportsRevision,
            ),
          }
        : null,
    }
  }

  return {
    savedPlans: activeResources.includes('savedPlans')
      ? {
          remoteSavedPlans: await loadSavedPlansFn({
            config: savedPlansConfig,
          }),
        }
      : null,
    reports: activeResources.includes('reports')
      ? {
          remoteReports: await loadReportsFn({
            config: reportsConfig,
          }),
        }
      : null,
  }
}
