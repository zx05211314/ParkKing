import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { STORE_SCHEMA_VERSION, normalizeScope } from './syncServiceConfig'
import {
  createLegacySyncServiceStore,
  normalizeSyncServiceBucket,
} from './syncServiceState'
import type { SyncServiceStore } from './syncServiceTypes'

export const readSyncStoreFile = async (
  storageFile: string,
  defaultScope: string,
): Promise<SyncServiceStore> => {
  try {
    const raw = await readFile(storageFile, 'utf8')
    const parsed = JSON.parse(raw) as Partial<SyncServiceStore>
    const buckets =
      parsed.buckets && typeof parsed.buckets === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.buckets).map(([scope, bucket]) => [
              normalizeScope(scope, defaultScope),
              normalizeSyncServiceBucket(bucket),
            ]),
          )
        : null

    return {
      schemaVersion:
        typeof parsed.schemaVersion === 'number'
          ? parsed.schemaVersion
          : STORE_SCHEMA_VERSION,
      buckets:
        buckets && Object.keys(buckets).length > 0
          ? buckets
          : createLegacySyncServiceStore(
              parsed.savedPlans,
              parsed.reports,
              defaultScope,
            ).buckets,
    }
  } catch {
    return createLegacySyncServiceStore([], [], defaultScope)
  }
}

export const writeSyncStoreFile = async (
  storageFile: string,
  store: SyncServiceStore,
) => {
  await mkdir(dirname(storageFile), { recursive: true })
  await writeFile(storageFile, JSON.stringify(store, null, 2), 'utf8')
}
