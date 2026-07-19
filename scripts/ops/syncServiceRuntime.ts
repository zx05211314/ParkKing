import { readSyncStoreFile, writeSyncStoreFile } from './syncServiceStore'
import { createSyncIssueSink } from './syncServiceIssueSink'
import type {
  SyncIssueSinkReceipt,
  SyncServiceConfig,
  SyncServiceStore,
} from './syncServiceTypes'

export interface SyncServiceRuntime {
  ensureStore(): Promise<SyncServiceStore>
  persistStore(store: SyncServiceStore): Promise<void>
  deliverIssueReport?(
    issue: unknown,
    scope?: string | null,
  ): Promise<SyncIssueSinkReceipt>
}

export const createSyncServiceRuntime = (
  config: SyncServiceConfig,
): SyncServiceRuntime => {
  let storePromise: Promise<SyncServiceStore> | null = null

  const ensureStore = async () => {
    if (!storePromise) {
      storePromise = readSyncStoreFile(config.storageFile, config.defaultScope)
    }
    return storePromise
  }

  const persistStore = async (store: SyncServiceStore) => {
    await writeSyncStoreFile(config.storageFile, store)
  }
  const deliverIssueReport = createSyncIssueSink(config)

  return {
    ensureStore,
    persistStore,
    deliverIssueReport,
  }
}
