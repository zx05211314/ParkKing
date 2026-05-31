import { describe, expect, it } from 'vitest'
import {
  isCurrentSyncStatusRequest,
  resolveSyncStatusClockBoundaryDelay,
  shouldApplySyncStatusSnapshot,
  shouldIgnoreSyncStatusError,
  shouldRefreshSyncStatus,
  SYNC_STATUS_CLOCK_MS,
  SYNC_STATUS_EVENT_REFRESH_COOLDOWN_MS,
} from './syncStatusPolling'

describe('syncStatusPolling', () => {
  it('gates sync status refreshes by endpoint, connectivity, in-flight state, and event cooldown', () => {
    const nowMs = 10_000

    expect(
      shouldRefreshSyncStatus({
        hasStatusEndpoint: false,
        isOnline: true,
        trigger: 'initial',
        refreshInFlight: false,
        nowMs,
        lastEventRefreshAt: 0,
      }),
    ).toBe(false)

    expect(
      shouldRefreshSyncStatus({
        hasStatusEndpoint: true,
        isOnline: false,
        trigger: 'initial',
        refreshInFlight: false,
        nowMs,
        lastEventRefreshAt: 0,
      }),
    ).toBe(false)

    expect(
      shouldRefreshSyncStatus({
        hasStatusEndpoint: true,
        isOnline: true,
        trigger: 'poll',
        refreshInFlight: true,
        nowMs,
        lastEventRefreshAt: 0,
      }),
    ).toBe(false)

    expect(
      shouldRefreshSyncStatus({
        hasStatusEndpoint: true,
        isOnline: true,
        trigger: 'event',
        refreshInFlight: false,
        nowMs,
        lastEventRefreshAt: nowMs - SYNC_STATUS_EVENT_REFRESH_COOLDOWN_MS + 1,
      }),
    ).toBe(false)

    expect(
      shouldRefreshSyncStatus({
        hasStatusEndpoint: true,
        isOnline: true,
        trigger: 'poll',
        refreshInFlight: false,
        nowMs,
        lastEventRefreshAt: 0,
      }),
    ).toBe(true)
  })

  it('resolves the next minute-aligned clock boundary delay', () => {
    expect(resolveSyncStatusClockBoundaryDelay(0)).toBe(SYNC_STATUS_CLOCK_MS)
    expect(resolveSyncStatusClockBoundaryDelay(1)).toBe(SYNC_STATUS_CLOCK_MS - 1)
    expect(resolveSyncStatusClockBoundaryDelay(59_999)).toBe(1)
    expect(resolveSyncStatusClockBoundaryDelay(120_000)).toBe(SYNC_STATUS_CLOCK_MS)
    expect(resolveSyncStatusClockBoundaryDelay(5_000, 0)).toBe(
      SYNC_STATUS_CLOCK_MS - 5_000,
    )
  })

  it('matches only the current non-aborted sync status request', () => {
    expect(
      isCurrentSyncStatusRequest({
        requestId: 3,
        activeRequestId: 3,
        aborted: false,
      }),
    ).toBe(true)

    expect(
      isCurrentSyncStatusRequest({
        requestId: 2,
        activeRequestId: 3,
        aborted: false,
      }),
    ).toBe(false)

    expect(
      isCurrentSyncStatusRequest({
        requestId: 3,
        activeRequestId: 3,
        aborted: true,
      }),
    ).toBe(false)
  })

  it('only applies snapshots from the current request', () => {
    expect(
      shouldApplySyncStatusSnapshot({
        requestId: 5,
        activeRequestId: 5,
        aborted: false,
        snapshot: {
          scope: 'alpha',
          savedPlansRevision: 1,
          reportsRevision: 2,
          issueReportsRevision: null,
          savedPlansCount: 3,
          reportsCount: 4,
          issueReportsCount: null,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: null,
        },
      }),
    ).toBe(true)

    expect(
      shouldApplySyncStatusSnapshot({
        requestId: 5,
        activeRequestId: 6,
        aborted: false,
        snapshot: {
          scope: 'alpha',
          savedPlansRevision: 1,
          reportsRevision: 2,
          issueReportsRevision: null,
          savedPlansCount: 3,
          reportsCount: 4,
          issueReportsCount: null,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: null,
        },
      }),
    ).toBe(false)

    expect(
      shouldApplySyncStatusSnapshot({
        requestId: 5,
        activeRequestId: 5,
        aborted: false,
        snapshot: null,
      }),
    ).toBe(false)
  })

  it('ignores stale and aborted request errors', () => {
    expect(
      shouldIgnoreSyncStatusError({
        requestId: 7,
        activeRequestId: 7,
        aborted: false,
        error: new Error('boom'),
      }),
    ).toBe(false)

    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    expect(
      shouldIgnoreSyncStatusError({
        requestId: 7,
        activeRequestId: 7,
        aborted: false,
        error: abortError,
      }),
    ).toBe(true)

    expect(
      shouldIgnoreSyncStatusError({
        requestId: 7,
        activeRequestId: 8,
        aborted: false,
        error: new Error('stale'),
      }),
    ).toBe(true)

    expect(
      shouldIgnoreSyncStatusError({
        requestId: 7,
        activeRequestId: 7,
        aborted: true,
        error: new Error('ignored'),
      }),
    ).toBe(true)
  })
})
