import { describe, expect, it } from 'vitest'
import type { SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'
import type { SyncStatusSnapshot } from '../api/syncStatus'
import { buildRuntimeDiagnostics } from './syncStatusRuntimeDiagnostics'
import { buildFreshnessDetail } from './syncStatusRuntimeFreshness'
import { buildRuntimeSummaries } from './syncStatusRuntimeSummaries'

const makeRuntimeStatus = (
  overrides: Partial<SyncRuntimeStatusSnapshot['savedPlans']> = {},
): SyncRuntimeStatusSnapshot['savedPlans'] => ({
  mode: 'idle',
  message: '',
  updatedAt: null,
  lastFailureReason: null,
  lastFailureAt: null,
  lastRecoveredAt: null,
  lastRemoteAt: null,
  lastPushAt: null,
  lastRetryAt: null,
  lastRetrySource: null,
  retryAttemptCount: 0,
  nextRetryAt: null,
  pendingCount: 0,
  lastRemoteCount: null,
  lastPushCount: null,
  ...overrides,
})

const makeSnapshot = (
  overrides: Partial<SyncStatusSnapshot> = {},
): SyncStatusSnapshot => ({
  scope: 'alpha',
  savedPlansRevision: 4,
  reportsRevision: 3,
  issueReportsRevision: null,
  savedPlansCount: 8,
  reportsCount: 5,
  issueReportsCount: null,
  savedPlansUpdatedAt: '2026-03-14T00:09:00.000Z',
  reportsUpdatedAt: '2026-03-14T00:08:00.000Z',
  issueReportsUpdatedAt: null,
  ...overrides,
})

const makeRuntimeSnapshot = (
  overrides: Partial<{
    savedPlans: ReturnType<typeof makeRuntimeStatus>
    reports: ReturnType<typeof makeRuntimeStatus>
    issueReports: ReturnType<typeof makeRuntimeStatus>
  }> = {},
): SyncRuntimeStatusSnapshot => ({
  savedPlans: makeRuntimeStatus(),
  reports: makeRuntimeStatus(),
  issueReports: makeRuntimeStatus(),
  ...overrides,
})

describe('syncStatusRuntime helpers', () => {
  it('builds freshness detail from the newest available confirmation timestamps', () => {
    const nowMs = Date.parse('2026-03-14T00:10:00.000Z')

    expect(
      buildFreshnessDetail(
        makeSnapshot(),
        makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            lastRemoteAt: Date.parse('2026-03-14T00:02:00.000Z'),
          }),
          reports: makeRuntimeStatus({
            lastRemoteAt: Date.parse('2026-03-14T00:01:00.000Z'),
          }),
        }),
        nowMs,
      ),
    ).toBe('Last remote confirmation: saved plans 1 min ago; reports 2 min ago.')
  })

  it('builds retry, recovery, and failure diagnostics per resource', () => {
    const nowMs = Date.parse('2026-03-14T00:10:00.000Z')

    expect(
      buildRuntimeDiagnostics(
        makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'fallback-local',
            pendingCount: 3,
            lastRetrySource: 'manual',
            retryAttemptCount: 2,
            nextRetryAt: Date.parse('2026-03-14T00:12:00.000Z'),
            lastRetryAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastPushAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastPushCount: 8,
            lastFailureAt: Date.parse('2026-03-14T00:06:00.000Z'),
            lastFailureReason: 'Saved-plan request failed with 503.',
          }),
          reports: makeRuntimeStatus({
            mode: 'remote',
            lastPushAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastPushCount: 5,
            lastFailureAt: Date.parse('2026-03-14T00:02:00.000Z'),
            lastRecoveredAt: Date.parse('2026-03-14T00:09:00.000Z'),
          }),
        }),
        nowMs,
      ),
    ).toEqual({
      savedPlans: [
        '3 pending remote confirmation.',
        'manual retry 2 scheduled in 2 min.',
        'last manual retry 2 min ago.',
        'last successful push 10 min ago (8 confirmed).',
        'last failure 4 min ago. Saved-plan request failed with 503.',
      ],
      reports: [
        'last successful push 1 min ago (5 confirmed).',
        'recovered 1 min ago after the last failure 8 min ago.',
      ],
      issueReports: [],
    })
  })

  it('builds per-resource runtime summaries with remote updates and retry labels', () => {
    const nowMs = Date.parse('2026-03-14T00:10:00.000Z')

    expect(
      buildRuntimeSummaries(
        makeSnapshot({
          savedPlansRevision: 9,
          reportsRevision: 3,
        }),
        8,
        3,
        makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'fallback-local',
            pendingCount: 2,
            lastRemoteAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteCount: 6,
            lastPushAt: Date.parse('2026-03-14T00:04:00.000Z'),
            lastPushCount: 5,
            lastFailureAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastFailureReason: 'offline',
            lastRetrySource: 'auto',
            retryAttemptCount: 1,
            nextRetryAt: Date.parse('2026-03-14T00:11:00.000Z'),
          }),
          reports: makeRuntimeStatus({
            mode: 'remote',
            lastRemoteAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastRemoteCount: 5,
          }),
        }),
        nowMs,
      ),
    ).toEqual({
      savedPlans: {
        mode: 'fallback-local',
        pendingCount: 2,
        hasRemoteUpdates: true,
        lastPull: '1 min ago (6 remote)',
        lastPush: '6 min ago (5 confirmed)',
        lastFailure: '2 min ago',
        failureReason: 'offline',
        retry: 'auto retry 1 in 1 min',
      },
      reports: {
        mode: 'remote',
        pendingCount: 0,
        hasRemoteUpdates: false,
        lastPull: '2 min ago (5 remote)',
        lastPush: null,
        lastFailure: null,
        failureReason: null,
        retry: null,
      },
      issueReports: {
        mode: 'idle',
        pendingCount: 0,
        hasRemoteUpdates: false,
        lastPull: null,
        lastPush: null,
        lastFailure: null,
        failureReason: null,
        retry: null,
      },
    })
  })
})
