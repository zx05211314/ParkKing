import {
  appendSyncIssueReport,
  assertSyncIssueReport,
} from './syncServiceIssueReports'
import { appendSyncReport } from './syncServiceReports'
import { replaceSyncSavedPlans } from './syncServiceSavedPlans'
import { DEFAULT_SYNC_DURABILITY } from './syncServiceConfig'
import type { SyncService, SyncServiceConfig } from './syncServiceTypes'
import type { SyncServiceRuntime } from './syncServiceRuntime'

const persistSyncServiceStoreIfChanged = async (
  runtime: SyncServiceRuntime,
  store: Awaited<ReturnType<SyncServiceRuntime['ensureStore']>>,
  changed: boolean,
) => {
  if (changed) {
    await runtime.persistStore(store)
  }
}

export const createSyncServiceWriteApi = (
  config: SyncServiceConfig,
  runtime: SyncServiceRuntime,
): Pick<SyncService, 'replaceSavedPlans' | 'appendReport' | 'appendIssueReport'> => ({
  async replaceSavedPlans(plans, scope, expectedRevision) {
    const store = await runtime.ensureStore()
    const result = replaceSyncSavedPlans({
      store,
      scope,
      defaultScope: config.defaultScope,
      plans,
      expectedRevision,
      updatedAt: new Date().toISOString(),
    })
    await persistSyncServiceStoreIfChanged(runtime, store, result.changed)
    return result.result
  },
  async appendReport(report, scope) {
    const store = await runtime.ensureStore()
    const result = appendSyncReport({
      store,
      scope,
      defaultScope: config.defaultScope,
      report,
      updatedAt: new Date().toISOString(),
    })
    await persistSyncServiceStoreIfChanged(runtime, store, result.changed)
    return result.result
  },
  async appendIssueReport(issue, scope) {
    assertSyncIssueReport(issue)
    const sinkReceipt = runtime.deliverIssueReport
      ? await runtime.deliverIssueReport(issue, scope)
      : {
          configured: false,
          delivered: false,
          durability: config.durability ?? DEFAULT_SYNC_DURABILITY,
        }
    const store = await runtime.ensureStore()
    const result = appendSyncIssueReport({
      store,
      scope,
      defaultScope: config.defaultScope,
      issue,
      updatedAt: new Date().toISOString(),
      maxIssueReports: config.maxIssueReports,
    })
    await persistSyncServiceStoreIfChanged(runtime, store, result.changed)
    return {
      ...result.result,
      durable:
        sinkReceipt.delivered || sinkReceipt.durability === 'persistent',
      durability: sinkReceipt.durability,
    }
  },
})
