import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import { SharePanel } from './SharePanel'
import { ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE } from './issueReportSyncPresentation'
import { buildSharePanelSyncModel } from './sharePanelModel'

describe('SharePanel', () => {
  it('renders busy sync labels for refresh, pull, and per-resource retries', () => {
    const retryableResources: SyncRuntimeResource[] = ['savedPlans', 'reports']
    const syncStatus = {
      kind: 'warning' as const,
      message: 'Sync connected. Saved plans still have pending local writes.',
      detail: 'Last remote confirmation: saved plans 2 min ago; reports just now.',
      syncScope: 'alpha',
      diagnostics: ['Saved plans: 3 pending remote confirmation.'],
      generalDiagnostics: [],
      resourceDiagnostics: {
        savedPlans: ['3 pending remote confirmation.'],
        reports: [],
        issueReports: [],
      },
      resourceSummaries: {
        savedPlans: {
          mode: 'syncing' as const,
          pendingCount: 3,
          hasRemoteUpdates: true,
          lastPull: '2 min ago (8 remote)',
          lastPush: '6 min ago (5 confirmed)',
          lastFailure: '4 min ago',
          failureReason: 'Saved-plan request failed with 503.',
          retry: 'auto retry 2 in 2 min',
        },
        reports: {
          mode: 'remote' as const,
          pendingCount: 1,
          hasRemoteUpdates: false,
          lastPull: 'just now (5 remote)',
          lastPush: '1 min ago (5 confirmed)',
          lastFailure: null,
          failureReason: null,
          retry: null,
        },
        issueReports: {
          mode: 'idle' as const,
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
      retryableResources,
      retryableResourceCounts: {
        savedPlans: 3,
        reports: 1,
        issueReports: 0,
      },
    }
    const html = renderToStaticMarkup(
      <SharePanel
        hasShareableState
        currentShareUrl="https://parkking.example.test/share"
        currentSavedPlan={false}
        nativeShareSupported
        syncViewModel={buildSharePanelSyncModel(syncStatus)}
        canRefreshSync
        isRefreshingSync
        refreshingResources={{
          savedPlans: true,
          reports: false,
          issueReports: false,
        }}
        retryingResources={{
          savedPlans: true,
          reports: false,
          issueReports: false,
        }}
        shareStatus={null}
        onCopyShareLink={() => {}}
        onRefreshSync={() => {}}
        onRefreshResourceSync={() => {}}
        onRetryResourceSync={() => {}}
        onSaveCurrentPlan={() => {}}
        onNativeShare={() => {}}
      />,
    )

    expect(html).toContain('Refreshing...')
    expect(html).toContain('Pulling saved plans...')
    expect(html).toContain('Retrying saved plans...')
    expect(html).toContain('Retry reports (1)')
    expect(html).toContain('Pending writes: 4')
    expect(html).toContain('Sync connected. Saved plans still have pending local writes.')
    expect(html).toContain('Shared scope: alpha')
    expect(html).toContain('Remote status')
    expect(html).toContain('Last remote confirmation: saved plans 2 min ago; reports just now.')
    expect(html).toContain('Saved plans pull')
    expect(html).toContain('Saved plans push')
    expect(html).toContain('Saved plans failure')
    expect(html).toContain('Saved plans retry')
    expect(html).toContain('Saved plans')
    expect(html).toContain('Pending')
    expect(html).toContain('Synced')
    expect(html).toContain('Updates available')
    expect(html).toContain('3 pending')
    expect(html).toContain('2 min ago (8 remote)')
    expect(html).toContain('6 min ago (5 confirmed)')
    expect(html).toContain('4 min ago | Saved-plan request failed with 503.')
    expect(html).toContain('3 pending remote confirmation.')
  })

  it('shows write-only guidance for issue reports', () => {
    const html = renderToStaticMarkup(
      <SharePanel
        hasShareableState
        currentShareUrl="https://parkking.example.test/share"
        currentSavedPlan={false}
        nativeShareSupported
        syncViewModel={buildSharePanelSyncModel({
          kind: 'warning',
          message: 'Sync connected.',
          detail: null,
          syncScope: 'alpha',
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
        })}
        canRefreshSync
        isRefreshingSync={false}
        refreshingResources={{
          savedPlans: false,
          reports: false,
          issueReports: false,
        }}
        retryingResources={{
          savedPlans: false,
          reports: false,
          issueReports: false,
        }}
        shareStatus={null}
        onCopyShareLink={() => {}}
        onRefreshSync={() => {}}
        onRefreshResourceSync={() => {}}
        onRetryResourceSync={() => {}}
        onSaveCurrentPlan={() => {}}
        onNativeShare={() => {}}
      />,
    )

    expect(html).toContain('Issue reports')
    expect(html).toContain('Write-only')
    expect(html).toContain(ISSUE_REPORT_SYNC_UPLOAD_ONLY_NOTE)
    expect(html).not.toContain('Pull issue reports')
  })
})
