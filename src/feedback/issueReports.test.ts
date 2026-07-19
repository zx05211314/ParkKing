import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSyncRuntimeStatusSnapshot,
  resetSyncRuntimeStatusForTests,
} from '../api/syncRuntimeStatus'
import {
  appendIssueReport,
  ISSUE_REPORTS_STORAGE_KEY,
  readIssueReports,
  retryIssueReportsSync,
  resolveIssueReportSyncConfig,
} from './issueReports'

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

describe('issueReports persistence', () => {
  beforeEach(() => {
    const storage = createLocalStorage()
    ;(globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: storage,
    }
    storage.clear()
    resetSyncRuntimeStatusForTests()
  })

  afterEach(() => {
    resetSyncRuntimeStatusForTests()
    vi.restoreAllMocks()
    const globalRef = globalThis as Record<string, unknown>
    if ('window' in globalRef) {
      delete globalRef.window
    }
  })

  it('appends issue reports locally when no sync endpoint is configured', async () => {
    const result = await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-1',
        summary: 'Issue report for segment',
        bundle: { debug: true },
        createdAt: '2026-04-02T08:00:00.000Z',
        issueId: 'issue-a',
      },
      {
        config: { endpoint: null },
      },
    )

    expect(result).toEqual({
      issue: {
        schemaVersion: 1,
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        summary: 'Issue report for segment',
        createdAt: '2026-04-02T08:00:00.000Z',
        bundle: { debug: true },
      },
      remoteSynced: false,
      mode: 'local-only',
      message: 'Issue saved locally only.',
      failureReason: null,
    })
    expect(readIssueReports()).toEqual([result.issue])
    expect(
      JSON.parse(window.localStorage.getItem(ISSUE_REPORTS_STORAGE_KEY) ?? 'null'),
    ).toEqual(
      expect.objectContaining({
        issues: [result.issue],
      }),
    )
  })

  it('submits issue reports to the remote endpoint when configured', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (...args) => {
      void args
      return createJsonResponse({ ok: true }, 201)
    })

    const result = await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-2',
        summary: 'Issue report for district',
        bundle: { debug: true },
        createdAt: '2026-04-02T09:00:00.000Z',
        issueId: 'issue-b',
      },
      {
        config: { endpoint: 'https://api.parkking.test/issues' },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('https://api.parkking.test/issues')
    expect(result.remoteSynced).toBe(true)
    expect(result.mode).toBe('remote')
    expect(result.message).toBe(
      'Issue uploaded temporarily; the device copy was retained.',
    )
    expect(getSyncRuntimeStatusSnapshot().issueReports.message).toBe(
      'Issue reports were uploaded, but remote storage is temporary.',
    )
  })

  it('reports durable remote intake when the server confirms durability', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({ durable: true }, 201),
    )

    const result = await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-durable',
        summary: 'Durable issue report',
        bundle: { debug: true },
        issueId: 'issue-durable',
      },
      {
        config: { endpoint: 'https://api.parkking.test/issues' },
        fetchImpl,
      },
    )

    expect(result.remoteSynced).toBe(true)
    expect(result.message).toBe('Issue submitted to durable ParkKing storage.')
    expect(getSyncRuntimeStatusSnapshot().issueReports.message).toBe(
      'Issue reports are durably synced.',
    )
  })

  it('keeps issue reports locally when remote submission fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (...args) => {
      void args
      throw new Error('offline')
    })

    const result = await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: null,
        summary: 'Dataset issue report',
        bundle: { debug: true },
        createdAt: '2026-04-02T10:00:00.000Z',
        issueId: 'issue-c',
      },
      {
        config: { endpoint: 'https://api.parkking.test/issues' },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      },
    )

    expect(result.remoteSynced).toBe(false)
    expect(result.mode).toBe('fallback-local')
    expect(result.failureReason).toBe('offline')
    expect(readIssueReports()).toEqual([result.issue])
    expect(getSyncRuntimeStatusSnapshot().issueReports).toEqual(
      expect.objectContaining({
        mode: 'fallback-local',
        pendingCount: 1,
        lastFailureReason: 'offline',
      }),
    )
  })

  it('retries locally stored issue reports against the remote endpoint', async () => {
    await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-3',
        summary: 'Retry issue report',
        bundle: { debug: true },
        createdAt: '2026-04-02T11:00:00.000Z',
        issueId: 'issue-d',
      },
      {
        config: { endpoint: null },
      },
    )
    const fetchImpl = vi.fn<typeof fetch>(async (...args) => {
      void args
      return createJsonResponse({ ok: true }, 201)
    })

    await expect(
      retryIssueReportsSync({
        config: { endpoint: 'https://api.parkking.test/issues' },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      attemptedCount: 1,
      syncedCount: 1,
      remoteSynced: true,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('https://api.parkking.test/issues')
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      issue: expect.objectContaining({
        issueId: 'issue-d',
      }),
    })
    expect(getSyncRuntimeStatusSnapshot().issueReports).toEqual(
      expect.objectContaining({
        mode: 'remote',
        pendingCount: 0,
        lastRemoteCount: 1,
        lastPushCount: 1,
      }),
    )
  })

  it('keeps unsent issue reports pending when retry fails mid-batch', async () => {
    await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-4',
        summary: 'Retry issue report A',
        bundle: { debug: true },
        createdAt: '2026-04-02T12:00:00.000Z',
        issueId: 'issue-e',
      },
      {
        config: { endpoint: null },
      },
    )
    await appendIssueReport(
      {
        districtId: 'xinyi',
        segmentId: 'seg-5',
        summary: 'Retry issue report B',
        bundle: { debug: true },
        createdAt: '2026-04-02T12:01:00.000Z',
        issueId: 'issue-f',
      },
      {
        config: { endpoint: null },
      },
    )
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ ok: true }, 201))
      .mockRejectedValueOnce(new Error('offline again'))

    await expect(
      retryIssueReportsSync({
        config: { endpoint: 'https://api.parkking.test/issues' },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      attemptedCount: 2,
      syncedCount: 1,
      remoteSynced: false,
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(getSyncRuntimeStatusSnapshot().issueReports).toEqual(
      expect.objectContaining({
        mode: 'fallback-local',
        pendingCount: 1,
        lastFailureReason: 'offline again',
      }),
    )
  })

  it('resolves scoped issue endpoints from sync base url', () => {
    expect(
      resolveIssueReportSyncConfig({
        VITE_SYNC_BASE_URL: '/api/sync',
        VITE_SYNC_SCOPE: 'alpha',
      }),
    ).toEqual({
      endpoint: '/api/sync/issues?scope=alpha',
    })
  })
})
