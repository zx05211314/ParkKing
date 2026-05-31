import { describe, expect, it, vi } from 'vitest'
import { createSyncServiceWriteApi } from './syncServiceWriteApi'
import type { SyncServiceStore } from './syncServiceTypes'
import type { SyncServiceRuntime } from './syncServiceRuntime'

const createRuntime = (
  store: SyncServiceStore,
): SyncServiceRuntime & { persistStore: ReturnType<typeof vi.fn> } => ({
  ensureStore: vi.fn().mockResolvedValue(store),
  persistStore: vi.fn().mockResolvedValue(undefined),
})

describe('syncServiceWriteApi', () => {
  it('persists report writes when a report changes the scoped store', async () => {
    const runtime = createRuntime({
      schemaVersion: 1,
      buckets: {
        default: {
          savedPlans: [],
          reports: [],
          issueReports: [],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 0,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: null,
        },
      },
    })
    const service = createSyncServiceWriteApi(
      {
        path: '/api/sync',
        port: 8789,
        storageFile: 'sync.json',
        defaultScope: 'default',
      },
      runtime,
    )

    await expect(
      service.appendReport(
        {
          id: 'report-a',
          districtId: 'xinyi',
          segmentId: '1001',
          status: 'LEGAL',
          createdAt: '2026-03-20T02:00:00.000Z',
        },
        'default',
      ),
    ).resolves.toEqual({
      report: {
        id: 'report-a',
        districtId: 'xinyi',
        segmentId: '1001',
        status: 'LEGAL',
        createdAt: '2026-03-20T02:00:00.000Z',
      },
      revision: 1,
    })
    expect(runtime.persistStore).toHaveBeenCalledTimes(1)
  })
})
