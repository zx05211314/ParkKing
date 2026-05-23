import { afterEach, describe, expect, it } from 'vitest'
import {
  loadSyncStatus,
  parseSyncReadinessPayload,
  parseSyncStatusPayload,
  resolveSyncStatusConfig,
  SYNC_SERVICE_DEGRADED_MESSAGE,
} from './syncStatus'

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('syncStatus', () => {
  it('parses a valid sync status payload', () => {
    expect(
      parseSyncStatusPayload({
        scope: 'alpha',
        savedPlansRevision: 2,
        reportsRevision: 3,
        savedPlansCount: 4,
        reportsCount: 5,
        savedPlansUpdatedAt: '2026-03-13T00:00:00.000Z',
        reportsUpdatedAt: '2026-03-13T01:00:00.000Z',
      }),
    ).toEqual({
      scope: 'alpha',
      savedPlansRevision: 2,
      reportsRevision: 3,
      issueReportsRevision: null,
      savedPlansCount: 4,
      reportsCount: 5,
      issueReportsCount: null,
      savedPlansUpdatedAt: '2026-03-13T00:00:00.000Z',
      reportsUpdatedAt: '2026-03-13T01:00:00.000Z',
      issueReportsUpdatedAt: null,
    })
  })

  it('defaults to the localhost first-party status endpoint', () => {
    ;(globalThis as { window?: { location: { hostname: string } } }).window = {
      location: {
        hostname: 'localhost',
      },
    }

    expect(resolveSyncStatusConfig()).toEqual({
      endpoint: '/api/sync/status',
      readinessEndpoint: '/api/sync/ready',
    })
  })

  it('parses sync readiness envelopes with snapshots', () => {
    expect(
      parseSyncReadinessPayload({
        service: 'sync-service',
        status: 'ok',
        issues: [],
        snapshot: {
          scope: 'alpha',
          savedPlansRevision: 2,
          reportsRevision: 3,
          savedPlansCount: 4,
          reportsCount: 5,
        },
      }),
    ).toEqual({
      ok: true,
      issues: [],
      snapshot: {
        scope: 'alpha',
        savedPlansRevision: 2,
        reportsRevision: 3,
        issueReportsRevision: null,
        savedPlansCount: 4,
        reportsCount: 5,
        issueReportsCount: null,
        savedPlansUpdatedAt: null,
        reportsUpdatedAt: null,
        issueReportsUpdatedAt: null,
      },
    })
  })

  it('loads a sync status snapshot from the configured endpoint', async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          scope: 'alpha',
          savedPlansRevision: 2,
          reportsRevision: 3,
          savedPlansCount: 4,
          reportsCount: 5,
          savedPlansUpdatedAt: '2026-03-13T00:00:00.000Z',
          reportsUpdatedAt: '2026-03-13T01:00:00.000Z',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

    await expect(
      loadSyncStatus({
        config: {
          endpoint: 'https://api.parkking.test/status',
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      scope: 'alpha',
      savedPlansRevision: 2,
      reportsRevision: 3,
      issueReportsRevision: null,
      savedPlansCount: 4,
      reportsCount: 5,
      issueReportsCount: null,
      savedPlansUpdatedAt: '2026-03-13T00:00:00.000Z',
      reportsUpdatedAt: '2026-03-13T01:00:00.000Z',
      issueReportsUpdatedAt: null,
    })
  })

  it('passes an abort signal through to the sync status request', async () => {
    const abortController = new AbortController()
    let receivedSignal: AbortSignal | null = null
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal instanceof AbortSignal ? init.signal : null
      return new Response(
        JSON.stringify({
          scope: 'alpha',
          savedPlansRevision: 2,
          reportsRevision: 3,
          savedPlansCount: 4,
          reportsCount: 5,
          savedPlansUpdatedAt: '2026-03-13T00:00:00.000Z',
          reportsUpdatedAt: '2026-03-13T01:00:00.000Z',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    await loadSyncStatus({
      config: {
        endpoint: 'https://api.parkking.test/status',
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: abortController.signal,
    })

    expect(receivedSignal).toBe(abortController.signal)
  })

  it('uses readiness snapshots before falling back to the status endpoint', async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.parkking.test/ready')
      return new Response(
        JSON.stringify({
          service: 'sync-service',
          status: 'ok',
          issues: [],
          snapshot: {
            scope: 'alpha',
            savedPlansRevision: 8,
            reportsRevision: 9,
            savedPlansCount: 10,
            reportsCount: 11,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    await expect(
      loadSyncStatus({
        config: {
          endpoint: 'https://api.parkking.test/status',
          readinessEndpoint: 'https://api.parkking.test/ready',
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      scope: 'alpha',
      savedPlansRevision: 8,
      reportsRevision: 9,
      issueReportsRevision: null,
      savedPlansCount: 10,
      reportsCount: 11,
      issueReportsCount: null,
      savedPlansUpdatedAt: null,
      reportsUpdatedAt: null,
      issueReportsUpdatedAt: null,
    })
  })

  it('surfaces degraded sync readiness issues', async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          service: 'sync-service',
          status: 'degraded',
          issues: ['storage file is empty'],
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

    await expect(
      loadSyncStatus({
        config: {
          endpoint: 'https://api.parkking.test/status',
          readinessEndpoint: 'https://api.parkking.test/ready',
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(`${SYNC_SERVICE_DEGRADED_MESSAGE}: storage file is empty`)
  })
})
