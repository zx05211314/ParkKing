import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appendIssueReport,
  ISSUE_REPORTS_STORAGE_KEY,
  readIssueReports,
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
  })

  afterEach(() => {
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
