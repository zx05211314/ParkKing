import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSyncRuntimeStatusSnapshot,
  resetSyncRuntimeStatusForTests,
} from '../api/syncRuntimeStatus'
import {
  appendReport,
  getReportsRevision,
  loadReports,
  readReports,
  REPORTS_STORAGE_KEY,
  resetReportsPersistenceStateForTests,
  retryReportsSync,
} from './reports'

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

describe('reports persistence', () => {
  beforeEach(() => {
    resetReportsPersistenceStateForTests()
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

  it('appends reports locally and normalizes segment ids and notes', () => {
    const report = appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-1-part-2',
        status: 'ILLEGAL',
        note: '  blocked by bus stop  ',
        createdAt: '2026-03-13T12:00:00.000Z',
      },
      {
        config: { endpoint: null },
      },
    )

    expect(report).toEqual({
      schemaVersion: 1,
      districtId: 'xinyi',
      segmentId: 'seg-1',
      status: 'ILLEGAL',
      note: 'blocked by bus stop',
      createdAt: '2026-03-13T12:00:00.000Z',
    })

    expect(readReports()).toEqual([report])
    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'local-only',
      }),
    )
  })

  it('loads remote reports and merges them with local unsynced reports', async () => {
    appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'local-seg',
        status: 'LEGAL',
        createdAt: '2026-03-13T10:00:00.000Z',
      },
      {
        config: { endpoint: null },
      },
    )

    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        reports: [
          {
            schemaVersion: 1,
            districtId: 'daan',
            segmentId: 'remote-seg',
            status: 'UNCLEAR',
            note: 'needs sign check',
            createdAt: '2026-03-13T11:00:00.000Z',
          },
        ],
        revision: 5,
      }),
    ) as unknown as typeof fetch

    await expect(
      loadReports({
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        districtId: 'xinyi',
        segmentId: 'local-seg',
      }),
      expect.objectContaining({
        districtId: 'daan',
        segmentId: 'remote-seg',
      }),
    ])

    expect(readReports()).toEqual([
      expect.objectContaining({
        districtId: 'xinyi',
        segmentId: 'local-seg',
      }),
      expect.objectContaining({
        districtId: 'daan',
        segmentId: 'remote-seg',
      }),
    ])
    expect(getReportsRevision('https://api.parkking.test/reports')).toBe(5)
    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'syncing',
        pendingCount: 1,
        lastRemoteCount: 1,
      }),
    )
  })

  it('keeps the local cache when the remote reports payload is malformed', async () => {
    appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'ILLEGAL',
        createdAt: '2026-03-13T12:00:00.000Z',
      },
      {
        config: { endpoint: null },
      },
    )

    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        unexpected: true,
      }),
    ) as unknown as typeof fetch

    await expect(
      loadReports({
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        districtId: 'xinyi',
        segmentId: 'seg-1',
      }),
    ])

    expect(JSON.parse(window.localStorage.getItem(REPORTS_STORAGE_KEY) ?? 'null')).toEqual(
      expect.objectContaining({
        reports: [
          expect.objectContaining({
            districtId: 'xinyi',
            segmentId: 'seg-1',
          }),
        ],
      }),
    )
  })

  it('keeps local reports when remote loading fails', async () => {
    appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-13T12:00:00.000Z',
      },
      {
        config: { endpoint: null },
      },
    )

    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    await expect(
      loadReports({
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        districtId: 'xinyi',
        segmentId: 'seg-1',
      }),
    ])

    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'fallback-local',
      }),
    )
  })

  it('writes reports locally even when remote append sync fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    const report = appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-2',
        status: 'UNCLEAR',
        createdAt: '2026-03-13T12:00:00.000Z',
      },
      {
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      },
    )

    await Promise.resolve()

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(readReports()).toEqual([report])
  })

  it('marks reports as syncing while remote append confirmation is pending', async () => {
    const fetchImpl = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as typeof fetch

    appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-3',
        status: 'LEGAL',
        createdAt: '2026-03-13T12:30:00.000Z',
      },
      {
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      },
    )

    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'syncing',
      }),
    )
  })

  it('retries local reports to the remote endpoint and marks them as synced', async () => {
    appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-4',
        status: 'LEGAL',
        createdAt: '2026-03-13T13:00:00.000Z',
      },
      {
        config: { endpoint: null },
      },
    )

    const fetchImpl = vi.fn(async () =>
      createJsonResponse({
        revision: 7,
      }),
    ) as unknown as typeof fetch

    await expect(
      retryReportsSync({
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      }),
    ).resolves.toEqual({
      attemptedCount: 1,
      syncedCount: 1,
      remoteSynced: true,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(getReportsRevision('https://api.parkking.test/reports')).toBe(7)
    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'remote',
      }),
    )
  })

  it('keeps reports in fallback-local mode when retry sync still fails', async () => {
    appendReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-5',
        status: 'UNCLEAR',
        createdAt: '2026-03-13T13:05:00.000Z',
      },
      {
        config: { endpoint: null },
      },
    )

    const fetchImpl = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch

    await expect(
      retryReportsSync({
        config: { endpoint: 'https://api.parkking.test/reports' },
        fetchImpl,
      }),
    ).resolves.toEqual({
      attemptedCount: 1,
      syncedCount: 0,
      remoteSynced: false,
    })

    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'fallback-local',
      }),
    )
  })
})
