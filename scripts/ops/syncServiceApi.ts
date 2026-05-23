import { createSyncServiceReadApi } from './syncServiceReadApi'
import { createSyncServiceWriteApi } from './syncServiceWriteApi'
import type { SyncService, SyncServiceConfig } from './syncServiceTypes'
import type { SyncServiceRuntime } from './syncServiceRuntime'

export const createSyncServiceApi = (
  config: SyncServiceConfig,
  runtime: SyncServiceRuntime,
): SyncService => ({
  ...createSyncServiceReadApi(config, runtime),
  ...createSyncServiceWriteApi(config, runtime),
})
