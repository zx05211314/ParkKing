import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSyncRuntimeStatusSnapshot,
  noteSyncRuntimeRetryAttempt,
  resetSyncRuntimeStatusForTests,
  setSyncRuntimeResourceStatus,
  subscribeSyncRuntimeStatus,
} from './syncRuntimeStatus'

afterEach(() => {
  resetSyncRuntimeStatusForTests()
  vi.restoreAllMocks()
})

describe('syncRuntimeStatus', () => {
  it('tracks per-resource runtime sync modes', () => {
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'fallback-local',
      message: 'Saved plans are using local fallback.',
      failureReason: 'Saved-plan request failed with 503.',
    })

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        mode: 'fallback-local',
        message: 'Saved plans are using local fallback.',
        lastFailureReason: 'Saved-plan request failed with 503.',
        lastFailureAt: expect.any(Number),
        lastRetryAt: null,
        lastRetrySource: null,
        retryAttemptCount: 0,
        nextRetryAt: null,
        pendingCount: 0,
        lastRemoteCount: null,
        lastPushAt: null,
        lastPushCount: null,
      }),
    )
  })

  it('tracks recovery timing after a fallback-local failure', () => {
    setSyncRuntimeResourceStatus('reports', {
      mode: 'fallback-local',
      message: 'Reports are using local fallback.',
      failureReason: 'offline',
    })
    const failedSnapshot = getSyncRuntimeStatusSnapshot().reports

    setSyncRuntimeResourceStatus('reports', {
      mode: 'remote',
      message: 'Reports are synced.',
      remoteEvent: 'pull',
    })

    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        mode: 'remote',
        lastFailureReason: 'offline',
        lastFailureAt: failedSnapshot.lastFailureAt,
        lastRecoveredAt: expect.any(Number),
        lastRemoteAt: expect.any(Number),
        lastPushAt: null,
        lastRetrySource: null,
        retryAttemptCount: 0,
        nextRetryAt: null,
        pendingCount: 0,
      }),
    )
  })

  it('tracks retry attempts and resets retry state after recovery', () => {
    noteSyncRuntimeRetryAttempt('savedPlans', {
      nowMs: 1_000,
      baseDelayMs: 60_000,
      maxDelayMs: 15 * 60_000,
      jitterRatio: 0,
      source: 'manual',
    })
    noteSyncRuntimeRetryAttempt('savedPlans', {
      nowMs: 2_000,
      baseDelayMs: 60_000,
      maxDelayMs: 15 * 60_000,
      jitterRatio: 0,
      source: 'auto',
    })

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        lastRetryAt: 2_000,
        lastRetrySource: 'auto',
        retryAttemptCount: 2,
        nextRetryAt: 122_000,
      }),
    )

    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'remote',
      message: 'Saved plans are synced.',
    })

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        retryAttemptCount: 0,
        nextRetryAt: null,
      }),
    )
  })

  it('applies jitter to retry scheduling when configured', () => {
    noteSyncRuntimeRetryAttempt('reports', {
      nowMs: 5_000,
      baseDelayMs: 60_000,
      maxDelayMs: 15 * 60_000,
      jitterRatio: 0.25,
      randomFn: () => 1,
      source: 'manual',
    })

    expect(getSyncRuntimeStatusSnapshot().reports).toEqual(
      expect.objectContaining({
        lastRetryAt: 5_000,
        lastRetrySource: 'manual',
        retryAttemptCount: 1,
        nextRetryAt: 80_000,
      }),
    )
  })

  it('notifies listeners when runtime sync state changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSyncRuntimeStatus(listener)

    setSyncRuntimeResourceStatus('reports', {
      mode: 'remote',
      message: 'Reports are synced.',
    })

    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    setSyncRuntimeResourceStatus('reports', {
      mode: 'fallback-local',
      message: 'Reports fell back locally.',
    })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('preserves the last successful push when a later remote pull completes', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_000)

    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'remote',
      message: 'Saved plans were pushed.',
      lastRemoteCount: 5,
      remoteEvent: 'push',
    })
    setSyncRuntimeResourceStatus('savedPlans', {
      mode: 'remote',
      message: 'Saved plans were pulled.',
      lastRemoteCount: 6,
      remoteEvent: 'pull',
    })

    expect(getSyncRuntimeStatusSnapshot().savedPlans).toEqual(
      expect.objectContaining({
        lastRemoteAt: 2_000,
        lastRemoteCount: 6,
        lastPushAt: 1_000,
        lastPushCount: 5,
      }),
    )
  })
})
