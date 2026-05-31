import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EVENT_DRIVEN_SYNC_RECOVERY_COOLDOWN_MS,
  resolveSyncRetryDelayMs,
  shouldAutoRefreshRemoteUpdate,
  shouldRunEventDrivenSyncRecovery,
} from './syncRecovery'

describe('syncRecovery', () => {
  it('detects when a remote update should auto-refresh', () => {
    expect(
      shouldAutoRefreshRemoteUpdate({
        syncKind: 'warning',
        remoteUpdateKey: '4:2',
        lastAutoRefreshKey: null,
      }),
    ).toBe(true)
    expect(
      shouldAutoRefreshRemoteUpdate({
        syncKind: 'warning',
        remoteUpdateKey: '4:2',
        lastAutoRefreshKey: '4:2',
      }),
    ).toBe(false)
    expect(
      shouldAutoRefreshRemoteUpdate({
        syncKind: 'success',
        remoteUpdateKey: '4:2',
        lastAutoRefreshKey: null,
      }),
    ).toBe(false)
  })

  it('computes retry delay from the next retry timestamp', () => {
    expect(resolveSyncRetryDelayMs(null, 1000)).toBe(0)
    expect(resolveSyncRetryDelayMs(2500, 1000)).toBe(1500)
    expect(resolveSyncRetryDelayMs(500, 1000)).toBe(0)
  })

  it('gates event-driven sync recovery by online state, in-flight state, and cooldown', () => {
    const nowMs = 10_000
    expect(
      shouldRunEventDrivenSyncRecovery({
        syncKind: 'warning',
        isOnline: true,
        recoveryInFlight: false,
        nowMs,
        lastRecoveryAt: nowMs - DEFAULT_EVENT_DRIVEN_SYNC_RECOVERY_COOLDOWN_MS,
      }),
    ).toBe(true)
    expect(
      shouldRunEventDrivenSyncRecovery({
        syncKind: 'local',
        isOnline: true,
        recoveryInFlight: false,
        nowMs,
        lastRecoveryAt: 0,
      }),
    ).toBe(false)
    expect(
      shouldRunEventDrivenSyncRecovery({
        syncKind: 'warning',
        isOnline: false,
        recoveryInFlight: false,
        nowMs,
        lastRecoveryAt: 0,
      }),
    ).toBe(false)
    expect(
      shouldRunEventDrivenSyncRecovery({
        syncKind: 'warning',
        isOnline: true,
        recoveryInFlight: true,
        nowMs,
        lastRecoveryAt: 0,
      }),
    ).toBe(false)
    expect(
      shouldRunEventDrivenSyncRecovery({
        syncKind: 'warning',
        isOnline: true,
        recoveryInFlight: false,
        nowMs,
        lastRecoveryAt: nowMs - 1,
      }),
    ).toBe(false)
  })
})
