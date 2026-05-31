import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { readSyncStoreFile, writeSyncStoreFile } from './syncServiceFileStore'

describe('syncServiceFileStore', () => {
  it('round-trips the scoped sync store payload and falls back for missing files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sync-store-file-'))
    const storageFile = path.join(base, 'sync-store.json')

    await expect(readSyncStoreFile(storageFile, 'default')).resolves.toMatchObject({
      schemaVersion: 1,
      buckets: {
        default: {
          savedPlans: [],
          reports: [],
        },
      },
    })

    await writeSyncStoreFile(storageFile, {
      schemaVersion: 1,
      buckets: {
        alpha: {
          savedPlans: [{ key: 'plan-a' }],
          savedPlansRevision: 2,
          savedPlansUpdatedAt: null,
          reports: [],
          reportsRevision: 0,
          reportsUpdatedAt: null,
          issueReports: [],
          issueReportsRevision: 0,
          issueReportsUpdatedAt: null,
        },
      },
    })

    await expect(readSyncStoreFile(storageFile, 'default')).resolves.toMatchObject({
      buckets: {
        alpha: {
          savedPlansRevision: 2,
        },
      },
    })
  })
})
