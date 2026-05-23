import { readSyncStoreFile, writeSyncStoreFile } from './syncServiceStore'
import type { SyncServiceConfig, SyncServiceStore } from './syncServiceTypes'

export interface SyncServiceRuntime {
  ensureStore(): Promise<SyncServiceStore>
  persistStore(store: SyncServiceStore): Promise<void>
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

  return {
    ensureStore,
    persistStore,
  }
}
