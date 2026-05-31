import { describe, expect, it } from 'vitest'
import { buildSharePanelSyncModel } from './sharePanelModel'

describe('sharePanelModel', () => {
  it('groups resource diagnostics and keeps general diagnostics separate', () => {
    expect(
      buildSharePanelSyncModel({
        kind: 'warning',
        message: 'Sync connected.',
        detail: null,
        syncScope: 'alpha',
        diagnostics: [
          'Browser is offline. Remote sync will resume when the connection returns.',
          'Saved plans: 3 pending remote confirmation.',
          'Saved plans: auto retry 2 scheduled in 2 min.',
          'Reports: last successful push 1 min ago (5 confirmed).',
        ],
        generalDiagnostics: [
          'Browser is offline. Remote sync will resume when the connection returns.',
        ],
        resourceDiagnostics: {
          savedPlans: [
            '3 pending remote confirmation.',
            'auto retry 2 scheduled in 2 min.',
          ],
          reports: ['last successful push 1 min ago (5 confirmed).'],
          issueReports: [],
        },
        resourceSummaries: {
          savedPlans: {
            mode: 'syncing',
            pendingCount: 3,
            hasRemoteUpdates: true,
            lastPull: '2 min ago (8 remote)',
            lastPush: '4 min ago (7 confirmed)',
            lastFailure: null,
            failureReason: null,
            retry: 'auto retry 2 in 2 min',
          },
          reports: {
            mode: 'remote',
            pendingCount: 0,
            hasRemoteUpdates: false,
            lastPull: '1 min ago (5 remote)',
            lastPush: '1 min ago (5 confirmed)',
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
        startupSyncHydrationPhase: 'ready' as const,
        startupSyncHydrationSource: null,
        canRetryWrites: true,
        retryableResources: ['savedPlans'],
        retryableResourceCounts: {
          savedPlans: 3,
          reports: 0,
          issueReports: 0,
        },
      }),
    ).toEqual({
      message: 'Sync connected.',
      syncScope: 'alpha',
      statusChipLabel: 'Attention',
      statusClassName: 'status-warning',
      showPendingWriteCount: true,
      pendingWriteCount: 3,
      generalDiagnostics: [
        'Browser is offline. Remote sync will resume when the connection returns.',
      ],
      timelineEntries: [
        {
          id: 'savedPlans-pull',
          label: 'Saved plans pull',
          value: '2 min ago (8 remote)',
          statusClassName: 'status-success',
        },
        {
          id: 'savedPlans-push',
          label: 'Saved plans push',
          value: '4 min ago (7 confirmed)',
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
          id: 'reports-push',
          label: 'Reports push',
          value: '1 min ago (5 confirmed)',
          statusClassName: 'status-success',
        },
      ],
      resourceCards: [
        {
          resource: 'savedPlans',
          label: 'Saved plans',
          modeLabel: 'Pending',
          modeClassName: 'status-warning',
          hasRemoteUpdates: true,
          diagnostics: [
            '3 pending remote confirmation.',
            'auto retry 2 scheduled in 2 min.',
          ],
          pendingCount: 3,
          canRetry: true,
        },
        {
          resource: 'reports',
          label: 'Reports',
          modeLabel: 'Synced',
          modeClassName: 'status-success',
          hasRemoteUpdates: false,
          diagnostics: ['last successful push 1 min ago (5 confirmed).'],
          pendingCount: 0,
          canRetry: false,
        },
      ],
    })
  })

  it('promotes startup bootstrap progress into the sync chip and detail', () => {
    expect(
      buildSharePanelSyncModel({
        kind: 'success',
        message: 'Sync connected. Bootstrapping shared state...',
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
            mode: 'idle',
            pendingCount: 0,
            hasRemoteUpdates: false,
            lastPull: null,
            lastPush: null,
            lastFailure: null,
            failureReason: null,
            retry: null,
          },
          reports: {
            mode: 'idle',
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
        startupSyncHydrationPhase: 'sync-bootstrap',
        startupSyncHydrationSource: null,
        canRetryWrites: false,
        retryableResources: [],
        retryableResourceCounts: {
          savedPlans: 0,
          reports: 0,
          issueReports: 0,
        },
      }),
    ).toEqual({
      message: 'Sync connected. Bootstrapping shared state...',
      syncScope: null,
      statusChipLabel: 'Bootstrapping',
      statusClassName: 'status-warning',
      showPendingWriteCount: false,
      pendingWriteCount: 0,
      generalDiagnostics: [],
      timelineEntries: [
        {
          id: 'startup',
          label: 'Startup',
          value: 'Loading shared saved plans and reports for this scope.',
          statusClassName: 'status-warning',
        },
      ],
      resourceCards: [],
    })
  })

  it('keeps local fallback startup detail visible after hydration is ready', () => {
    expect(
      buildSharePanelSyncModel({
        kind: 'warning',
        message: 'Sync connected. Local fallback state loaded; waiting for remote status...',
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
            mode: 'fallback-local',
            pendingCount: 0,
            hasRemoteUpdates: false,
            lastPull: null,
            lastPush: null,
            lastFailure: null,
            failureReason: null,
            retry: null,
          },
          reports: {
            mode: 'fallback-local',
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
        startupSyncHydrationCompletedAgo: '2 min ago',
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'local-fallback',
        canRetryWrites: false,
        retryableResources: [],
        retryableResourceCounts: {
          savedPlans: 0,
          reports: 0,
          issueReports: 0,
        },
      }),
    ).toEqual({
      message: 'Sync connected. Local fallback state loaded; waiting for remote status...',
      syncScope: null,
      statusChipLabel: 'Attention',
      statusClassName: 'status-warning',
      showPendingWriteCount: false,
      pendingWriteCount: 0,
      generalDiagnostics: [],
      timelineEntries: [
        {
          id: 'startup',
          label: 'Startup',
          value:
            'Started from local saved plans and reports because shared bootstrap was unavailable (2 min ago).',
          statusClassName: 'status-warning',
        },
      ],
      resourceCards: [],
    })
  })
})
