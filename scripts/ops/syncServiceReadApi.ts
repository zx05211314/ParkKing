import { readSyncBootstrapState } from './syncServiceBootstrap'
import { readSyncIssueReportsState } from './syncServiceIssueReports'
import { readSyncReportsState } from './syncServiceReports'
import { readSyncSavedPlansState } from './syncServiceSavedPlans'
import {
  ensureSyncServiceBucket,
  readSyncStatusSnapshot,
} from './syncServiceState'
import type {
  SyncBootstrapResource,
  SyncService,
  SyncServiceConfig,
} from './syncServiceTypes'
import type { SyncServiceRuntime } from './syncServiceRuntime'

export const createSyncServiceReadApi = (
  config: SyncServiceConfig,
  runtime: SyncServiceRuntime,
): Pick<
  SyncService,
  | 'getSyncStatus'
  | 'getSavedPlansState'
  | 'getSavedPlans'
  | 'getReportsState'
  | 'getReports'
  | 'getIssueReportsState'
  | 'getIssueReports'
  | 'getBootstrapState'
> => {
  const getSyncStatus: SyncService['getSyncStatus'] = async (scope) => {
    const store = await runtime.ensureStore()
    const resolvedBucket = ensureSyncServiceBucket(
      store,
      scope,
      config.defaultScope,
    )
    return readSyncStatusSnapshot(resolvedBucket.bucket, resolvedBucket.scope)
  }

  const getSavedPlansState: SyncService['getSavedPlansState'] = async (scope) => {
    const store = await runtime.ensureStore()
    return readSyncSavedPlansState(store, scope, config.defaultScope)
  }

  const getSavedPlans: SyncService['getSavedPlans'] = async (scope) => {
    return (await getSavedPlansState(scope)).plans
  }

  const getReportsState: SyncService['getReportsState'] = async (scope) => {
    const store = await runtime.ensureStore()
    return readSyncReportsState(store, scope, config.defaultScope)
  }

  const getReports: SyncService['getReports'] = async (scope) => {
    return (await getReportsState(scope)).reports
  }

  const getIssueReportsState: SyncService['getIssueReportsState'] = async (scope) => {
    const store = await runtime.ensureStore()
    return readSyncIssueReportsState(store, scope, config.defaultScope)
  }

  const getIssueReports: SyncService['getIssueReports'] = async (scope) => {
    return (await getIssueReportsState(scope)).issues
  }

  const getBootstrapState: SyncService['getBootstrapState'] = async (
    scope,
    resources: SyncBootstrapResource[] = ['savedPlans', 'reports'],
  ) => {
    const store = await runtime.ensureStore()
    return readSyncBootstrapState(store, scope, config.defaultScope, resources)
  }

  return {
    getSyncStatus,
    getSavedPlansState,
    getSavedPlans,
    getReportsState,
    getReports,
    getIssueReportsState,
    getIssueReports,
    getBootstrapState,
  }
}
