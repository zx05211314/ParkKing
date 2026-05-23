import { describe, expect, it } from 'vitest'
import { ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE } from './issueReportSyncPresentation'
import { buildSyncStatusMessage } from './syncStatusMessage'

const makeRuntimeStatus = (
  overrides: Partial<{
    mode: 'idle' | 'local-only' | 'syncing' | 'remote' | 'fallback-local'
    message: string
    updatedAt: number | null
    lastFailureReason: string | null
    lastFailureAt: number | null
    lastRecoveredAt: number | null
    lastRemoteAt: number | null
    lastPushAt: number | null
    lastRetryAt: number | null
    lastRetrySource: 'auto' | 'manual' | null
    retryAttemptCount: number
    nextRetryAt: number | null
    pendingCount: number
    lastRemoteCount: number | null
    lastPushCount: number | null
  }> = {},
) => ({
  mode: 'idle' as const,
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

const makeResourceSummary = (
  overrides: Partial<{
    mode: 'idle' | 'local-only' | 'syncing' | 'remote' | 'fallback-local'
    pendingCount: number
    hasRemoteUpdates: boolean
    lastPull: string | null
    lastPush: string | null
    lastFailure: string | null
    failureReason: string | null
    retry: string | null
  }> = {},
) => ({
  mode: 'idle' as const,
  pendingCount: 0,
  hasRemoteUpdates: false,
  lastPull: null,
  lastPush: null,
  lastFailure: null,
  failureReason: null,
  retry: null,
  ...overrides,
})

const makeRuntimeSnapshot = (
  overrides: Partial<{
    savedPlans: ReturnType<typeof makeRuntimeStatus>
    reports: ReturnType<typeof makeRuntimeStatus>
    issueReports: ReturnType<typeof makeRuntimeStatus>
  }> = {},
) => ({
  savedPlans: makeRuntimeStatus(),
  reports: makeRuntimeStatus(),
  issueReports: makeRuntimeStatus(),
  ...overrides,
})

const makeResourceSummaries = (
  overrides: Partial<{
    savedPlans: ReturnType<typeof makeResourceSummary>
    reports: ReturnType<typeof makeResourceSummary>
    issueReports: ReturnType<typeof makeResourceSummary>
  }> = {},
) => ({
  savedPlans: makeResourceSummary(),
  reports: makeResourceSummary(),
  issueReports: makeResourceSummary(),
  ...overrides,
})

const makeSnapshot = (
  overrides: Partial<{
    scope: string | null
    savedPlansRevision: number
    reportsRevision: number
    issueReportsRevision: number | null
    savedPlansCount: number
    reportsCount: number
    issueReportsCount: number | null
    savedPlansUpdatedAt: string | null
    reportsUpdatedAt: string | null
    issueReportsUpdatedAt: string | null
  }> = {},
) => ({
  scope: 'alpha' as const,
  savedPlansRevision: 3,
  reportsRevision: 4,
  issueReportsRevision: null,
  savedPlansCount: 8,
  reportsCount: 5,
  issueReportsCount: null,
  savedPlansUpdatedAt: '2026-03-14T00:00:00.000Z',
  reportsUpdatedAt: '2026-03-14T00:00:00.000Z',
  issueReportsUpdatedAt: null,
  ...overrides,
})

describe('syncStatusMessage', () => {
  it('reports local-only mode when no sync endpoints are configured', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: false,
        hasSavedPlansEndpoint: false,
        hasReportsEndpoint: false,
        hasStatusEndpoint: false,
        statusError: false,
        snapshot: null,
        localSavedPlansRevision: null,
        localReportsRevision: null,
        runtimeSnapshot: makeRuntimeSnapshot(),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: null,
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
      kind: 'local',
      message: 'Sync is local-only in this session.',
      detail: null,
      syncScope: null,
      diagnostics: [],
      generalDiagnostics: [],
      resourceDiagnostics: {
        savedPlans: [],
        reports: [],
        issueReports: [],
      },
      resourceSummaries: makeResourceSummaries(),
      remoteUpdateKey: null,
      remoteUpdateResources: [],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'ready',
      startupSyncHydrationSource: null,
      canRetryWrites: false,
      nextRetryAt: null,
      retryableResources: [],
      retryableResourceCounts: {
        savedPlans: 0,
        reports: 0,
        issueReports: 0,
      },
    })
  })

  it('keeps issue report upload-only diagnostics visible when shared sync is local-only', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: false,
        hasSavedPlansEndpoint: false,
        hasReportsEndpoint: false,
        hasIssueReportsEndpoint: true,
        hasStatusEndpoint: false,
        statusError: false,
        snapshot: null,
        localSavedPlansRevision: null,
        localReportsRevision: null,
        runtimeSnapshot: makeRuntimeSnapshot(),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: null,
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
      kind: 'local',
      message:
        'Shared sync is local-only in this session. Issue reports can still upload from this device.',
      detail: null,
      syncScope: null,
      diagnostics: [ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE],
      generalDiagnostics: [ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE],
      resourceDiagnostics: {
        savedPlans: [],
        reports: [],
        issueReports: [],
      },
      resourceSummaries: makeResourceSummaries(),
      remoteUpdateKey: null,
      remoteUpdateResources: [],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'ready',
      startupSyncHydrationSource: null,
      canRetryWrites: false,
      nextRetryAt: null,
      retryableResources: [],
      retryableResourceCounts: {
        savedPlans: 0,
        reports: 0,
        issueReports: 0,
      },
    })
  })

  it('does not present issue reports as a shared readable scope count', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasIssueReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: makeSnapshot({
          issueReportsRevision: 7,
          issueReportsCount: 12,
          issueReportsUpdatedAt: '2026-03-14T00:09:00.000Z',
        }),
        localSavedPlansRevision: 3,
        localReportsRevision: 4,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'remote',
            message: 'Saved plans are synced.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteCount: 8,
          }),
          reports: makeRuntimeStatus({
            mode: 'remote',
            message: 'Reports are synced.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteCount: 5,
          }),
          issueReports: makeRuntimeStatus({
            mode: 'remote',
            message: 'Issue reports are synced.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastPushAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastPushCount: 12,
          }),
        }),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual(
      expect.objectContaining({
        kind: 'success',
        message: 'Sync connected. Scope has 8 saved plans and 5 reports.',
        syncScope: 'alpha',
      }),
    )
  })

  it('surfaces startup bootstrap progress before the first shared snapshot lands', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: null,
        localSavedPlansRevision: null,
        localReportsRevision: null,
        runtimeSnapshot: makeRuntimeSnapshot(),
        startupSyncHydrationPhase: 'sync-bootstrap',
        startupSyncHydrationSource: null,
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
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
      resourceSummaries: makeResourceSummaries(),
      remoteUpdateKey: null,
      remoteUpdateResources: [],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'sync-bootstrap',
      startupSyncHydrationSource: null,
      canRetryWrites: false,
      nextRetryAt: null,
      retryableResources: [],
      retryableResourceCounts: {
        savedPlans: 0,
        reports: 0,
        issueReports: 0,
      },
    })
  })

  it('surfaces runtime fallback degradation even when status is otherwise connected', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: makeSnapshot(),
        localSavedPlansRevision: 3,
        localReportsRevision: 4,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'fallback-local',
            message: 'Saved plans are using local fallback.',
            updatedAt: Date.parse('2026-03-14T00:06:00.000Z'),
            lastFailureReason: 'Saved-plan request failed with 503.',
            lastFailureAt: Date.parse('2026-03-14T00:06:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRetryAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastRetrySource: 'manual',
            retryAttemptCount: 2,
            nextRetryAt: Date.parse('2026-03-14T00:12:00.000Z'),
            pendingCount: 8,
            lastRemoteCount: 8,
          }),
          reports: makeRuntimeStatus({
            mode: 'remote',
            message: 'Reports are synced.',
            updatedAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRecoveredAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRemoteCount: 5,
          }),
        }),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
      kind: 'warning',
      message: 'Sync connected. Saved plans are using local fallback.',
      detail: 'Last remote confirmation: saved plans 10 min ago; reports 10 min ago.',
      syncScope: 'alpha',
      diagnostics: [
        'Saved plans: 8 pending remote confirmation.',
        'Saved plans: manual retry 2 scheduled in 2 min.',
        'Saved plans: last manual retry 2 min ago.',
        'Saved plans: last successful push 10 min ago (8 confirmed).',
        'Saved plans: last failure 4 min ago. Saved-plan request failed with 503.',
      ],
      generalDiagnostics: [],
      resourceDiagnostics: {
        savedPlans: [
          '8 pending remote confirmation.',
          'manual retry 2 scheduled in 2 min.',
          'last manual retry 2 min ago.',
          'last successful push 10 min ago (8 confirmed).',
          'last failure 4 min ago. Saved-plan request failed with 503.',
        ],
        reports: [],
        issueReports: [],
      },
      resourceSummaries: makeResourceSummaries({
        savedPlans: makeResourceSummary({
          mode: 'fallback-local',
          pendingCount: 8,
          lastPull: '10 min ago (8 remote)',
          lastPush: null,
          lastFailure: '4 min ago',
          failureReason: 'Saved-plan request failed with 503.',
          retry: 'manual retry 2 in 2 min',
        }),
        reports: makeResourceSummary({
          mode: 'remote',
          pendingCount: 0,
          lastPull: '10 min ago (5 remote)',
        }),
      }),
      remoteUpdateKey: null,
      remoteUpdateResources: [],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'ready',
      startupSyncHydrationSource: 'shared',
      canRetryWrites: true,
      nextRetryAt: Date.parse('2026-03-14T00:12:00.000Z'),
      retryableResources: ['savedPlans'],
      retryableResourceCounts: {
        savedPlans: 8,
        reports: 0,
        issueReports: 0,
      },
    })
  })

  it('combines remote updates with runtime degradation', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: makeSnapshot({
          savedPlansRevision: 9,
        }),
        localSavedPlansRevision: 8,
        localReportsRevision: 4,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'remote',
            message: 'Saved plans are synced.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRecoveredAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRemoteCount: 8,
          }),
          reports: makeRuntimeStatus({
            mode: 'fallback-local',
            message: 'Reports are using local fallback.',
            updatedAt: Date.parse('2026-03-14T00:07:00.000Z'),
            lastFailureReason: 'offline',
            lastFailureAt: Date.parse('2026-03-14T00:07:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRetryAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRetrySource: 'auto',
            retryAttemptCount: 1,
            nextRetryAt: Date.parse('2026-03-14T00:11:00.000Z'),
            pendingCount: 2,
            lastRemoteCount: 5,
          }),
        }),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
      kind: 'warning',
      message: 'Remote updates are available for saved plans. Reports are using local fallback.',
      detail: 'Last remote confirmation: saved plans 10 min ago; reports 10 min ago.',
      syncScope: 'alpha',
      diagnostics: [
        'Reports: 2 pending remote confirmation.',
        'Reports: auto retry 1 scheduled in 1 min.',
        'Reports: last auto retry 1 min ago.',
        'Reports: last successful push 10 min ago (5 confirmed).',
        'Reports: last failure 3 min ago. offline',
      ],
      generalDiagnostics: [],
      resourceDiagnostics: {
        savedPlans: [],
        reports: [
          '2 pending remote confirmation.',
          'auto retry 1 scheduled in 1 min.',
          'last auto retry 1 min ago.',
          'last successful push 10 min ago (5 confirmed).',
          'last failure 3 min ago. offline',
        ],
        issueReports: [],
      },
      resourceSummaries: makeResourceSummaries({
        savedPlans: makeResourceSummary({
          mode: 'remote',
          pendingCount: 0,
          lastPull: '10 min ago (8 remote)',
          hasRemoteUpdates: true,
        }),
        reports: makeResourceSummary({
          mode: 'fallback-local',
          pendingCount: 2,
          lastPull: '10 min ago (5 remote)',
          lastPush: null,
          lastFailure: '3 min ago',
          failureReason: 'offline',
          retry: 'auto retry 1 in 1 min',
        }),
      }),
      remoteUpdateKey: '9:4',
      remoteUpdateResources: ['savedPlans'],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'ready',
      startupSyncHydrationSource: 'shared',
      canRetryWrites: true,
      nextRetryAt: Date.parse('2026-03-14T00:11:00.000Z'),
      retryableResources: ['reports'],
      retryableResourceCounts: {
        savedPlans: 0,
        reports: 2,
        issueReports: 0,
      },
    })
  })

  it('surfaces pending remote confirmation as a warning', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: makeSnapshot(),
        localSavedPlansRevision: 3,
        localReportsRevision: 4,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'syncing',
            message: 'Saved plans are waiting for remote confirmation.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastFailureReason: 'Saved-plan request failed with 503.',
            lastFailureAt: Date.parse('2026-03-14T00:06:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:00:00.000Z'),
            lastRetryAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastRetrySource: 'auto',
            retryAttemptCount: 2,
            nextRetryAt: Date.parse('2026-03-14T00:09:30.000Z'),
            pendingCount: 3,
            lastRemoteCount: 8,
          }),
          reports: makeRuntimeStatus({
            mode: 'remote',
            message: 'Reports are synced.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastFailureReason: 'offline',
            lastFailureAt: Date.parse('2026-03-14T00:02:00.000Z'),
            lastRecoveredAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteCount: 5,
          }),
        }),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
      kind: 'warning',
      message: 'Sync connected. Saved plans are waiting for remote confirmation.',
      detail: 'Last remote confirmation: saved plans 10 min ago; reports 10 min ago.',
      syncScope: 'alpha',
      diagnostics: [
        'Saved plans: 3 pending remote confirmation.',
        'Saved plans: auto retry window is open now.',
        'Saved plans: last auto retry 2 min ago.',
        'Saved plans: last successful push 10 min ago (8 confirmed).',
        'Saved plans: last failure 4 min ago. Saved-plan request failed with 503.',
        'Reports: last successful push 1 min ago (5 confirmed).',
        'Reports: recovered 1 min ago after the last failure 8 min ago.',
      ],
      generalDiagnostics: [],
      resourceDiagnostics: {
        savedPlans: [
          '3 pending remote confirmation.',
          'auto retry window is open now.',
          'last auto retry 2 min ago.',
          'last successful push 10 min ago (8 confirmed).',
          'last failure 4 min ago. Saved-plan request failed with 503.',
        ],
        reports: [
          'last successful push 1 min ago (5 confirmed).',
          'recovered 1 min ago after the last failure 8 min ago.',
        ],
        issueReports: [],
      },
      resourceSummaries: makeResourceSummaries({
        savedPlans: makeResourceSummary({
          mode: 'syncing',
          pendingCount: 3,
          lastPull: '10 min ago (8 remote)',
          lastPush: null,
          lastFailure: '4 min ago',
          failureReason: 'Saved-plan request failed with 503.',
          retry: 'auto retry 2 now',
        }),
        reports: makeResourceSummary({
          mode: 'remote',
          pendingCount: 0,
          lastPull: '1 min ago (5 remote)',
          lastPush: null,
          lastFailure: '8 min ago',
          failureReason: 'offline',
          retry: null,
        }),
      }),
      remoteUpdateKey: null,
      remoteUpdateResources: [],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'ready',
      startupSyncHydrationSource: 'shared',
      canRetryWrites: true,
      nextRetryAt: Date.parse('2026-03-14T00:10:00.000Z'),
      retryableResources: ['savedPlans'],
      retryableResourceCounts: {
        savedPlans: 3,
        reports: 0,
        issueReports: 0,
      },
    })
  })

  it('downgrades connected sync status while the browser is offline', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: makeSnapshot({
          savedPlansUpdatedAt: '2026-03-14T00:08:00.000Z',
          reportsUpdatedAt: '2026-03-14T00:09:00.000Z',
        }),
        localSavedPlansRevision: 3,
        localReportsRevision: 4,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'remote',
            message: 'Saved plans are synced.',
            updatedAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastRemoteCount: 8,
          }),
          reports: makeRuntimeStatus({
            mode: 'remote',
            message: 'Reports are synced.',
            updatedAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastRemoteCount: 5,
          }),
        }),
        isOnline: false,
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual({
      kind: 'warning',
      message:
        'Sync connected. Scope has 8 saved plans and 5 reports. Browser is offline.',
      detail: 'Last remote confirmation: saved plans 2 min ago; reports 1 min ago.',
      syncScope: 'alpha',
      diagnostics: [
        'Browser is offline. Remote sync will resume when the connection returns.',
      ],
      generalDiagnostics: [
        'Browser is offline. Remote sync will resume when the connection returns.',
      ],
      resourceDiagnostics: {
        savedPlans: [],
        reports: [],
        issueReports: [],
      },
      resourceSummaries: makeResourceSummaries({
        savedPlans: makeResourceSummary({
          mode: 'remote',
          pendingCount: 0,
          lastPull: '2 min ago (8 remote)',
        }),
        reports: makeResourceSummary({
          mode: 'remote',
          pendingCount: 0,
          lastPull: '1 min ago (5 remote)',
        }),
      }),
      remoteUpdateKey: null,
      remoteUpdateResources: [],
      startupSyncHydrationCompletedAgo: null,
      startupSyncHydrationPhase: 'ready',
      startupSyncHydrationSource: 'shared',
      canRetryWrites: false,
      nextRetryAt: null,
      retryableResources: [],
      retryableResourceCounts: {
        savedPlans: 0,
        reports: 0,
        issueReports: 0,
      },
    })
  })

  it('keeps the last successful push age stable after a newer remote pull', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: null,
        localSavedPlansRevision: null,
        localReportsRevision: null,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'fallback-local',
            message: 'Saved plans are using local fallback.',
            lastFailureReason: 'offline',
            lastFailureAt: Date.parse('2026-03-14T00:08:00.000Z'),
            lastRemoteAt: Date.parse('2026-03-14T00:09:00.000Z'),
            lastPushAt: Date.parse('2026-03-14T00:04:00.000Z'),
            pendingCount: 2,
            lastRemoteCount: 6,
            lastPushCount: 5,
          }),
          reports: makeRuntimeStatus(),
        }),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual(
      expect.objectContaining({
        diagnostics: [
          'Saved plans: 2 pending remote confirmation.',
          'Saved plans: last successful push 6 min ago (5 confirmed).',
          'Saved plans: last failure 2 min ago. offline',
        ],
        syncScope: null,
        resourceDiagnostics: {
          savedPlans: [
            '2 pending remote confirmation.',
            'last successful push 6 min ago (5 confirmed).',
            'last failure 2 min ago. offline',
          ],
          reports: [],
          issueReports: [],
        },
        resourceSummaries: makeResourceSummaries({
          savedPlans: makeResourceSummary({
            mode: 'fallback-local',
            pendingCount: 2,
            lastPull: '1 min ago (6 remote)',
            lastPush: '6 min ago (5 confirmed)',
            lastFailure: '2 min ago',
            failureReason: 'offline',
            retry: null,
          }),
          reports: makeResourceSummary(),
        }),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'shared',
      }),
    )
  })

  it('distinguishes ready local fallback from active bootstrap when status is still loading', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: false,
        snapshot: null,
        localSavedPlansRevision: null,
        localReportsRevision: null,
        runtimeSnapshot: makeRuntimeSnapshot({
          savedPlans: makeRuntimeStatus({
            mode: 'fallback-local',
            message: 'Saved plans are using local fallback.',
          }),
          reports: makeRuntimeStatus({
            mode: 'fallback-local',
            message: 'Reports are using local fallback.',
          }),
        }),
        startupSyncHydrationCompletedAt: Date.parse('2026-03-14T00:08:00.000Z'),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'local-fallback',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual(
      expect.objectContaining({
        kind: 'warning',
        message:
          'Sync connected. Saved plans and reports are using local fallback.',
        syncScope: null,
        startupSyncHydrationCompletedAgo: '2 min ago',
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'local-fallback',
      }),
    )
  })

  it('surfaces the specific remote status failure when readiness is degraded', () => {
    expect(
      buildSyncStatusMessage({
        hasSyncBaseUrl: true,
        hasSavedPlansEndpoint: true,
        hasReportsEndpoint: true,
        hasStatusEndpoint: true,
        statusError: true,
        statusErrorMessage: 'Sync service is degraded: storage file is empty',
        snapshot: null,
        localSavedPlansRevision: null,
        localReportsRevision: null,
        runtimeSnapshot: makeRuntimeSnapshot(),
        startupSyncHydrationPhase: 'ready',
        startupSyncHydrationSource: 'local-fallback',
        nowMs: Date.parse('2026-03-14T00:10:00.000Z'),
      }),
    ).toEqual(
      expect.objectContaining({
        kind: 'error',
        message:
          'Sync service is degraded: storage file is empty. Local data stays unchanged.',
        syncScope: null,
      }),
    )
  })
})
