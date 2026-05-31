import { beforeEach, describe, expect, it, vi } from 'vitest'
import { REPORTS_STORAGE_KEY } from '../feedback/reports'
import { resetSettingsCacheForTests, STORAGE_KEYS } from '../settings'
import {
  getSavedPlansRevision,
  resetSavedPlansPersistenceStateForTests,
} from './savedPlansPersistence'
import {
  fetchSyncBootstrapSnapshot,
  loadSyncBootstrap,
  loadSyncBootstrapOnce,
  resetSyncBootstrapCacheForTests,
} from './syncBootstrap'

const createLocalStorage = () => {
  const store = new Map<string, string>()
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

beforeEach(() => {
  resetSyncBootstrapCacheForTests()
  resetSettingsCacheForTests()
  resetSavedPlansPersistenceStateForTests()
  ;(globalThis as {
    window?: {
      localStorage: ReturnType<typeof createLocalStorage>
      location: {
        origin: string
        hostname: string
      }
    }
  }).window = {
    localStorage: createLocalStorage(),
    location: {
      origin: 'http://localhost:4173',
      hostname: 'localhost',
    },
  }
})

describe('loadSyncBootstrap', () => {
  it('hydrates both saved plans and reports from one bootstrap response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        plans: [
          {
            key: 'plan-1',
            title: 'Taipei 101',
            url: '/?plan=1',
            createdAt: '2026-03-13T00:00:00.000Z',
          },
        ],
        reports: [
          {
            schemaVersion: 1,
            districtId: 'xinyi',
            segmentId: 'seg-1',
            status: 'ILLEGAL',
            createdAt: '2026-03-13T00:00:00.000Z',
          },
        ],
        savedPlansRevision: 4,
        reportsRevision: 6,
      }),
    })

    await expect(
      loadSyncBootstrap({
        config: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      savedPlans: [
        {
          key: '/?plan=1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
          datasetId: null,
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          pinned: false,
        },
      ],
      reports: [
        {
          schemaVersion: 1,
          districtId: 'xinyi',
          segmentId: 'seg-1',
          status: 'ILLEGAL',
          note: null,
          createdAt: '2026-03-13T00:00:00.000Z',
        },
      ],
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(STORAGE_KEYS.savedPlans)).toContain('Taipei 101')
    expect(window.localStorage.getItem(REPORTS_STORAGE_KEY)).toContain('seg-1')
    expect(getSavedPlansRevision('/api/sync/saved-plans')).toBe(4)
  })

  it('reuses the same in-flight bootstrap request for repeated callers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        plans: [],
        reports: [],
      }),
    })

    const first = loadSyncBootstrap({
      config: {
        endpoint: '/api/sync/bootstrap',
        savedPlansEndpoint: '/api/sync/saved-plans',
        reportsEndpoint: '/api/sync/reports',
      },
      fetchImpl,
    })
    const second = loadSyncBootstrap({
      config: {
        endpoint: '/api/sync/bootstrap',
        savedPlansEndpoint: '/api/sync/saved-plans',
        reportsEndpoint: '/api/sync/reports',
      },
      fetchImpl,
    })

    await expect(first).resolves.toEqual({
      savedPlans: [],
      reports: [],
    })
    await expect(second).resolves.toEqual({
      savedPlans: [],
      reports: [],
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('refetches bootstrap data after the in-flight request settles', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          plans: [],
          reports: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          plans: [],
          reports: [],
        }),
      })

    await expect(
      loadSyncBootstrap({
        config: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      savedPlans: [],
      reports: [],
    })
    await expect(
      loadSyncBootstrap({
        config: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      savedPlans: [],
      reports: [],
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns null when no bootstrap endpoint is configured', async () => {
    await expect(
      loadSyncBootstrap({
        config: {
          endpoint: null,
          savedPlansEndpoint: null,
          reportsEndpoint: null,
        },
      }),
    ).resolves.toBeNull()
  })

  it('requests only the selected bootstrap resource when a scoped refresh is needed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        plans: [
          {
            key: 'plan-1',
            title: 'Taipei 101',
            url: '/?plan=1',
            createdAt: '2026-03-13T00:00:00.000Z',
          },
        ],
        savedPlansRevision: 7,
      }),
    })

    await expect(
      fetchSyncBootstrapSnapshot({
        config: {
          endpoint: '/api/sync/bootstrap?scope=demo',
          savedPlansEndpoint: '/api/sync/saved-plans?scope=demo',
          reportsEndpoint: '/api/sync/reports?scope=demo',
        },
        fetchImpl,
        resources: ['savedPlans'],
      }),
    ).resolves.toEqual({
      savedPlans: [
        {
          key: '/?plan=1',
          title: 'Taipei 101',
          url: '/?plan=1',
          createdAt: '2026-03-13T00:00:00.000Z',
          datasetId: null,
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          pinned: false,
        },
      ],
      reports: [],
      savedPlansRevision: 7,
      reportsRevision: null,
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:4173/api/sync/bootstrap?scope=demo&include=savedPlans',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      }),
    )
  })

  it('reuses the resolved bootstrap snapshot for repeated startup hydration callers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        plans: [],
        reports: [],
      }),
    })

    await expect(
      loadSyncBootstrapOnce({
        config: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      savedPlans: [],
      reports: [],
    })
    await expect(
      loadSyncBootstrapOnce({
        config: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchImpl,
      }),
    ).resolves.toEqual({
      savedPlans: [],
      reports: [],
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
