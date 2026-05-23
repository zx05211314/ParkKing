import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import { SharePanelResourceGrid } from './SharePanelResourceGrid'
import { SharePanelSyncTimeline } from './SharePanelSyncTimeline'
import type { SharePanelSyncModel } from './sharePanelTypes'

interface ShareStatus {
  kind: 'success' | 'error'
  message: string
}

interface SharePanelProps {
  hasShareableState: boolean
  currentShareUrl: string | null
  currentSavedPlan: boolean
  nativeShareSupported: boolean
  syncViewModel: SharePanelSyncModel
  canRefreshSync: boolean
  isRefreshingSync: boolean
  refreshingResources: Record<SyncRuntimeResource, boolean>
  retryingResources: Record<SyncRuntimeResource, boolean>
  shareStatus: ShareStatus | null
  onCopyShareLink: () => void | Promise<void>
  onRefreshSync: () => void | Promise<void>
  onRefreshResourceSync: (
    resource: SyncRuntimeResource,
  ) => void | Promise<void>
  onRetryResourceSync: (resource: SyncRuntimeResource) => void | Promise<void>
  onSaveCurrentPlan: () => void
  onNativeShare: () => void | Promise<void>
}

export const SharePanel = ({
  hasShareableState,
  currentShareUrl,
  currentSavedPlan,
  nativeShareSupported,
  syncViewModel,
  canRefreshSync,
  isRefreshingSync,
  refreshingResources,
  retryingResources,
  shareStatus,
  onCopyShareLink,
  onRefreshSync,
  onRefreshResourceSync,
  onRetryResourceSync,
  onSaveCurrentPlan,
  onNativeShare,
}: SharePanelProps) => (
  <div className="control-group">
    <div className="control-label">Share</div>
    <div className="control-meta">
      {hasShareableState
    ? 'Link includes the current dataset, pinned location, selected target, and ranking settings.'
        : 'Pin an address, pick a parking target, or add a filter to create a share link.'}
    </div>
    <div className="search-actions">
      <button
        type="button"
        className="sheet-close"
        onClick={() => void onCopyShareLink()}
        disabled={!hasShareableState}
      >
        Copy share link
      </button>
      <button
        type="button"
        className="sheet-close"
        onClick={() => void onRefreshSync()}
        disabled={!canRefreshSync || isRefreshingSync}
      >
        {isRefreshingSync ? 'Refreshing...' : 'Refresh sync'}
      </button>
      <button
        type="button"
        className="sheet-close"
        onClick={onSaveCurrentPlan}
        disabled={!hasShareableState}
      >
        {currentSavedPlan ? 'Update saved plan' : 'Save current plan'}
      </button>
      {nativeShareSupported ? (
        <button
          type="button"
          className="sheet-close"
          onClick={() => void onNativeShare()}
          disabled={!hasShareableState}
        >
          Share
        </button>
      ) : null}
    </div>
    {currentShareUrl ? (
      <div className="control-meta">Current link tracks this parking view live.</div>
    ) : null}
    <div className="share-status-panel">
      <div className="share-status-header">
        <div
          className={['share-status-chip', syncViewModel.statusClassName]
            .filter(Boolean)
            .join(' ')}
        >
          {syncViewModel.statusChipLabel}
        </div>
        {syncViewModel.showPendingWriteCount ? (
          <div className="share-status-pending">
            Pending writes: {syncViewModel.pendingWriteCount}
          </div>
        ) : null}
      </div>
      <div
        className={['share-status-message', syncViewModel.statusClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {syncViewModel.message}
      </div>
      {syncViewModel.syncScope ? (
        <div className="control-meta">Shared scope: {syncViewModel.syncScope}</div>
      ) : null}
      <SharePanelSyncTimeline timelineEntries={syncViewModel.timelineEntries} />
      {syncViewModel.generalDiagnostics.length > 0 ? (
        <div className="share-status-diagnostics">
          {syncViewModel.generalDiagnostics.map((diagnostic) => (
            <div key={diagnostic} className="control-meta">
              {diagnostic}
            </div>
          ))}
        </div>
      ) : null}
      <SharePanelResourceGrid
        resourceCards={syncViewModel.resourceCards}
        refreshingResources={refreshingResources}
        retryingResources={retryingResources}
        onRefreshResourceSync={onRefreshResourceSync}
        onRetryResourceSync={onRetryResourceSync}
      />
    </div>
    {shareStatus ? (
      <div
        className={
          shareStatus.kind === 'error'
            ? 'control-meta status-error'
            : 'control-meta status-success'
        }
      >
        {shareStatus.message}
      </div>
    ) : null}
  </div>
)
