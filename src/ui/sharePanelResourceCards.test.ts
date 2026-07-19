import { describe, expect, it } from 'vitest'
import { ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE } from './issueReportSyncPresentation'
import { buildSharePanelResourceCards } from './sharePanelResourceCards'
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

describe('sharePanelResourceCards', () => {
  it('builds cards for resources with diagnostics, history, or retry state', () => {
    expect(
      buildSharePanelResourceCards(
        makeSyncStatus({
          resourceDiagnostics: {
            savedPlans: ['3 pending remote confirmation.'],
            reports: [],
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
          retryableResources: ['savedPlans'],
          retryableResourceCounts: {
            savedPlans: 3,
            reports: 0,
            issueReports: 0,
          },
        }),
      ),
    ).toEqual([
      {
        resource: 'savedPlans',
        label: 'Saved plans',
        modeLabel: 'Pending',
        modeClassName: 'status-warning',
        hasRemoteUpdates: true,
        diagnostics: ['3 pending remote confirmation.'],
        pendingCount: 3,
        canRetry: true,
      },
    ])
  })

  it('omits resources with no visible diagnostics or history', () => {
    expect(buildSharePanelResourceCards(makeSyncStatus({}))).toEqual([])
  })

  it('keeps issue reports visible when the resource is active without pull history', () => {
    expect(
      buildSharePanelResourceCards(
        makeSyncStatus({
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
              mode: 'local-only',
              pendingCount: 0,
              hasRemoteUpdates: false,
              lastPull: null,
              lastPush: null,
              lastFailure: null,
              failureReason: null,
              retry: null,
            },
          },
        }),
      ),
    ).toEqual([
      {
        resource: 'issueReports',
        label: 'Issue reports',
        modeLabel: 'Device only',
        modeClassName: 'status-warning',
        capabilityLabel: 'Write-only',
        note: ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE,
        hasRemoteUpdates: false,
        diagnostics: [],
        pendingCount: 0,
        canRetry: false,
      },
    ])
  })
})
