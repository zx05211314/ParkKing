import { describe, expect, it } from 'vitest'
import { buildSharePanelTimeline } from './sharePanelTimeline'
import type { SharePanelSyncStatus } from './sharePanelTypes'

const makeSyncStatus = (
  overrides: Partial<SharePanelSyncStatus>,
): SharePanelSyncStatus => ({
  kind: 'warning',
  message: 'Sync connected.',
  detail: null,
  syncScope: null,
  diagnostics: [],
  generalDiagnostics: [],
  resourceDiagnostics: {
    savedPlans: [],
    reports: [],
    issueReports: [],
  },
  resourceSummaries: {
    savedPlans: {
      mode: 'remote',
      pendingCount: 0,
      hasRemoteUpdates: false,
      lastPull: null,
      lastPush: null,
      lastFailure: null,
      failureReason: null,
      retry: null,
    },
    reports: {
      mode: 'remote',
      pendingCount: 0,
      hasRemoteUpdates: false,
      lastPull: null,
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
  },
  startupSyncHydrationCompletedAgo: null,
  startupSyncHydrationPhase: 'ready',
  startupSyncHydrationSource: null,
  canRetryWrites: false,
  retryableResources: [],
  retryableResourceCounts: {
    savedPlans: 0,
    reports: 0,
    issueReports: 0,
  },
  ...overrides,
})

describe('sharePanelTimeline', () => {
  it('orders startup before remote status and resource history', () => {
    expect(
      buildSharePanelTimeline(
        makeSyncStatus({
          detail: 'Last remote confirmation: saved plans 2 min ago; reports 1 min ago.',
          resourceSummaries: {
            savedPlans: {
              mode: 'syncing',
              pendingCount: 2,
              hasRemoteUpdates: false,
              lastPull: '2 min ago (8 remote)',
              lastPush: '5 min ago (6 confirmed)',
              lastFailure: null,
              failureReason: null,
              retry: 'auto retry 2 in 2 min',
            },
            reports: {
              mode: 'fallback-local',
              pendingCount: 0,
              hasRemoteUpdates: false,
              lastPull: '1 min ago (5 remote)',
              lastPush: null,
              lastFailure: 'just now',
              failureReason: 'offline',
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
          },
          startupSyncHydrationCompletedAgo: '3 min ago',
          startupSyncHydrationSource: 'shared',
        }),
      ),
    ).toEqual([
      {
        id: 'startup',
        label: 'Startup',
        value: 'Started from shared saved plans and reports for this scope (3 min ago).',
        statusClassName: 'status-success',
      },
      {
        id: 'remote-status',
        label: 'Remote status',
        value: 'Last remote confirmation: saved plans 2 min ago; reports 1 min ago.',
        statusClassName: '',
      },
      {
        id: 'savedPlans-pull',
        label: 'Saved plans pull',
        value: '2 min ago (8 remote)',
        statusClassName: 'status-success',
      },
      {
        id: 'savedPlans-push',
        label: 'Saved plans push',
        value: '5 min ago (6 confirmed)',
        statusClassName: 'status-success',
      },
      {
        id: 'savedPlans-retry',
        label: 'Saved plans retry',
        value: 'auto retry 2 in 2 min',
        statusClassName: 'status-warning',
      },
      {
        id: 'reports-pull',
        label: 'Reports pull',
        value: '1 min ago (5 remote)',
        statusClassName: 'status-success',
      },
      {
        id: 'reports-failure',
        label: 'Reports failure',
        value: 'just now | offline',
        statusClassName: 'status-error',
      },
    ])
  })
})
