import { describe, expect, it, vi } from 'vitest'
import { createSyncServiceApi } from './syncServiceApi'
import type { SyncServiceStore } from './syncServiceTypes'
import type { SyncServiceRuntime } from './syncServiceRuntime'

const createRuntime = (
  store: SyncServiceStore,
): SyncServiceRuntime & { persistStore: ReturnType<typeof vi.fn> } => ({
  ensureStore: vi.fn().mockResolvedValue(store),
  persistStore: vi.fn().mockResolvedValue(undefined),
})

describe('syncServiceApi', () => {
  it('does not persist store state for no-op saved-plan writes', async () => {
    const runtime = createRuntime({
      schemaVersion: 1,
      buckets: {
        default: {
          savedPlans: [
            {
              key: 'plan-a',
              title: 'A',
              url: '/?a',
              createdAt: '2026-03-13T00:00:00.000Z',
            },
          ],
          reports: [],
          savedPlansRevision: 1,
          reportsRevision: 0,
          savedPlansUpdatedAt: '2026-03-13T00:00:00.000Z',
          reportsUpdatedAt: null,
        },
      },
    })
    const service = createSyncServiceApi(
      {
        path: '/api/sync',
        port: 8789,
        storageFile: 'sync.json',
        defaultScope: 'default',
      },
      runtime,
    )

    await expect(
      service.replaceSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'A',
            url: '/?a',
            createdAt: '2026-03-13T00:00:00.000Z',
          },
        ],
        'default',
        1,
      ),
    ).resolves.toEqual({
      conflict: false,
      plans: [
        {
          key: 'plan-a',
          title: 'A',
          url: '/?a',
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ],
      revision: 1,
    })
    expect(runtime.persistStore).not.toHaveBeenCalled()
  })
})
