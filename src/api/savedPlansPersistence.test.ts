import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSavedPlansRevision,
  loadSavedPlans,
  resetSavedPlansPersistenceStateForTests,
  saveSavedPlans,
} from './savedPlansPersistence'
import {
  getSyncRuntimeStatusSnapshot,
  resetSyncRuntimeStatusForTests,
} from './syncRuntimeStatus'
import {
  resetSettingsCacheForTests,
  STORAGE_KEYS,
} from '../settings'

const createLocalStorage = (): Storage => {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

const createJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })

describe('savedPlansPersistence', () => {
  beforeEach(() => {
    resetSettingsCacheForTests()
    resetSavedPlansPersistenceStateForTests()
    resetSyncRuntimeStatusForTests()
    const storage = createLocalStorage()
    ;(globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: storage,
    }
    storage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    const globalRef = globalThis as Record<string, unknown>
    if ('window' in globalRef) {
      delete globalRef.window
    }
  })

  it('loads local saved plans when no remote endpoint is configured', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )
    window.localStorage.setItem(
      STORAGE_KEYS.savedPlans,
      JSON.stringify([
        {
          title: 'Local plan',
          url: 'https://park.example.com/?segment=seg-1',
          createdAt: '2026-03-13T09:00:00.000Z',
        },
      ]),
    )

    await expect(
      loadSavedPlans({
        config: { endpoint: null },
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: 'Local plan',
        url: 'https://park.example.com/?segment=seg-1',
      }),
    ])

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        mode: 'local-only',
      }),
    )
  })

  it('loads remote saved plans and refreshes the local cache', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )
    window.localStorage.setItem(
      STORAGE_KEYS.savedPlans,
      JSON.stringify([
        {
          title: 'Local fallback',
          url: 'https://park.example.com/?segment=local',
          createdAt: '2026-03-13T09:00:00.000Z',
        },
      ]),
    )

    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        plans: [
          {
            title: 'Remote plan',
            url: 'https://park.example.com/?segment=remote',
            createdAt: '2026-03-13T10:00:00.000Z',
          },
        ],
      }),
    ) as unknown as typeof fetch

    await expect(
      loadSavedPlans({
        config: { endpoint: 'https://api.parkking.test/plans' },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: 'Remote plan',
        url: 'https://park.example.com/?segment=remote',
      }),
    ])

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        mode: 'remote',
      }),
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedPlans) ?? 'null')).toEqual(
      [
        expect.objectContaining({
          title: 'Remote plan',
          url: 'https://park.example.com/?segment=remote',
        }),
      ],
    )
  })

  it('falls back to local saved plans when the remote load fails', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )
    window.localStorage.setItem(
      STORAGE_KEYS.savedPlans,
      JSON.stringify([
        {
          title: 'Local fallback',
          url: 'https://park.example.com/?segment=local',
          createdAt: '2026-03-13T09:00:00.000Z',
        },
      ]),
    )

    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    await expect(
      loadSavedPlans({
        config: { endpoint: 'https://api.parkking.test/plans' },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: 'Local fallback',
        url: 'https://park.example.com/?segment=local',
      }),
    ])

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        mode: 'fallback-local',
      }),
    )
  })

  it('keeps the local cache when the remote payload is malformed', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )
    window.localStorage.setItem(
      STORAGE_KEYS.savedPlans,
      JSON.stringify([
        {
          title: 'Local fallback',
          url: 'https://park.example.com/?segment=local',
          createdAt: '2026-03-13T09:00:00.000Z',
        },
      ]),
    )

    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        unexpected: true,
      }),
    ) as unknown as typeof fetch

    await expect(
      loadSavedPlans({
        config: { endpoint: 'https://api.parkking.test/plans' },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: 'Local fallback',
        url: 'https://park.example.com/?segment=local',
      }),
    ])

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedPlans) ?? 'null')).toEqual(
      [
        expect.objectContaining({
          title: 'Local fallback',
          url: 'https://park.example.com/?segment=local',
        }),
      ],
    )
  })

  it('writes local saved plans even when remote sync fails', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )

    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    await expect(
      saveSavedPlans(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Offline-safe plan',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-13T09:00:00.000Z',
          },
        ],
        {
          config: { endpoint: 'https://api.parkking.test/plans' },
          fetchImpl,
        },
      ),
    ).resolves.toEqual({
      plans: [
        expect.objectContaining({
          title: 'Offline-safe plan',
          url: 'https://park.example.com/?segment=seg-1',
        }),
      ],
      conflictedUrls: [],
      conflictDetails: [],
      remoteSynced: false,
    })

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedPlans) ?? 'null')).toEqual(
      [
        expect.objectContaining({
          title: 'Offline-safe plan',
          url: 'https://park.example.com/?segment=seg-1',
        }),
      ],
    )
  })

  it('marks saved plans as syncing while remote persistence is in flight', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )

    const fetchImpl = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as typeof fetch

    void saveSavedPlans(
      [
        {
          key: 'https://park.example.com/?segment=seg-2',
          title: 'Pending remote sync',
          url: 'https://park.example.com/?segment=seg-2',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-13T09:00:00.000Z',
        },
      ],
      {
        config: { endpoint: 'https://api.parkking.test/plans' },
        fetchImpl,
      },
    )

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        mode: 'syncing',
      }),
    )
  })

  it('merges remote plans and retries when the remote revision is stale', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )

    const endpoint = 'https://api.parkking.test/plans'
    const staleRemotePlans = [
      {
        key: 'https://park.example.com/?segment=remote',
        title: 'Remote plan',
        url: 'https://park.example.com/?segment=remote',
        createdAt: '2026-03-13T08:00:00.000Z',
      },
    ]
    const mergedPlans = [
      ...staleRemotePlans,
      {
        key: 'https://park.example.com/?segment=local',
        title: 'Local plan',
        url: 'https://park.example.com/?segment=local',
        createdAt: '2026-03-13T09:00:00.000Z',
      },
    ]

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          plans: staleRemotePlans,
          revision: 2,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            plans: staleRemotePlans,
            revision: 2,
          },
          409,
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          plans: mergedPlans,
          revision: 3,
        }),
      )

    await expect(
      loadSavedPlans({
        config: { endpoint },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: 'Remote plan',
        url: 'https://park.example.com/?segment=remote',
      }),
    ])

    await expect(
      saveSavedPlans(
        [
          {
            key: 'https://park.example.com/?segment=local',
            title: 'Local renamed plan',
            url: 'https://park.example.com/?segment=local',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-13T09:00:00.000Z',
          },
        ],
        {
          config: { endpoint },
          fetchImpl,
        },
      ),
    ).resolves.toEqual({
      plans: expect.arrayContaining([
        expect.objectContaining({
          title: 'Remote plan',
          url: 'https://park.example.com/?segment=remote',
        }),
        expect.objectContaining({
          title: 'Local renamed plan',
          url: 'https://park.example.com/?segment=local',
        }),
      ]),
      conflictedUrls: [],
      conflictDetails: [],
      remoteSynced: true,
    })

    const fetchCalls = (fetchImpl as unknown as { mock: { calls: Array<[string, RequestInit?]> } }).mock.calls
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchCalls[1]?.[0]).toBe(endpoint)
    expect(fetchCalls[2]?.[0]).toBe(endpoint)
    expect(fetchCalls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
      }),
    )
    expect(fetchCalls[2]?.[1]).toEqual(
      expect.objectContaining({
        method: 'PUT',
      }),
    )
    expect(
      JSON.parse(String(fetchCalls[1]?.[1]?.body)),
    ).toEqual({
      plans: [
        expect.objectContaining({
          title: 'Local renamed plan',
          url: 'https://park.example.com/?segment=local',
        }),
      ],
      revision: 2,
    })
    expect(
      JSON.parse(String(fetchCalls[2]?.[1]?.body)),
    ).toEqual({
      plans: expect.arrayContaining([
        expect.objectContaining({
          title: 'Remote plan',
          url: 'https://park.example.com/?segment=remote',
        }),
        expect.objectContaining({
          title: 'Local renamed plan',
          url: 'https://park.example.com/?segment=local',
        }),
      ]),
      revision: 2,
    })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.savedPlans) ?? 'null')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Remote plan',
          url: 'https://park.example.com/?segment=remote',
        }),
        expect.objectContaining({
          title: 'Local renamed plan',
          url: 'https://park.example.com/?segment=local',
        }),
      ]),
    )
    expect(getSavedPlansRevision(endpoint)).toBe(3)
  })

  it('reports conflicted urls when a stale remote revision has different shared edits', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settingsSchemaVersion,
      JSON.stringify(1),
    )

    const endpoint = 'https://api.parkking.test/plans'
    const staleRemotePlans = [
      {
        key: 'https://park.example.com/?segment=local',
        title: 'Remote renamed plan',
        url: 'https://park.example.com/?segment=local',
        createdAt: '2026-03-13T08:00:00.000Z',
        intent: 'BACKUP',
      },
    ]

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          plans: staleRemotePlans,
          revision: 4,
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          {
            plans: staleRemotePlans,
            revision: 4,
          },
          409,
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          plans: [
            {
              key: 'https://park.example.com/?segment=local',
              title: 'Local renamed plan',
              url: 'https://park.example.com/?segment=local',
              createdAt: '2026-03-13T09:00:00.000Z',
              intent: 'COMMUTE',
            },
          ],
          revision: 5,
        }),
      )

    await loadSavedPlans({
      config: { endpoint },
      fetchImpl,
    })

    await expect(
      saveSavedPlans(
        [
          {
            key: 'https://park.example.com/?segment=local',
            title: 'Local renamed plan',
            url: 'https://park.example.com/?segment=local',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-13T09:00:00.000Z',
            intent: 'COMMUTE',
          },
        ],
        {
          config: { endpoint },
          fetchImpl,
        },
      ),
    ).resolves.toEqual({
      plans: [
        expect.objectContaining({
          title: 'Local renamed plan',
          url: 'https://park.example.com/?segment=local',
          intent: 'COMMUTE',
        }),
      ],
      conflictedUrls: ['https://park.example.com/?segment=local'],
      conflictDetails: [
        {
          url: 'https://park.example.com/?segment=local',
          fields: [
            {
              label: 'Title',
              keptValue: 'Local renamed plan',
              sharedValue: 'Remote renamed plan',
            },
            {
              label: 'District',
              keptValue: 'xinyi',
              sharedValue: 'None',
            },
            {
              label: 'Intent',
              keptValue: 'Commute',
              sharedValue: 'Backup',
            },
          ],
          sharedPlan: expect.objectContaining({
            title: 'Remote renamed plan',
            url: 'https://park.example.com/?segment=local',
            intent: 'BACKUP',
          }),
        },
      ],
      remoteSynced: true,
    })
  })
})
