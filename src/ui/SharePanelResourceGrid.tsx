import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'
import type { SharePanelResourceCard } from './sharePanelTypes'

interface SharePanelResourceGridProps {
  resourceCards: SharePanelResourceCard[]
  refreshingResources: Record<SyncRuntimeResource, boolean>
  retryingResources: Record<SyncRuntimeResource, boolean>
  onRefreshResourceSync: (
    resource: SyncRuntimeResource,
  ) => void | Promise<void>
  onRetryResourceSync: (resource: SyncRuntimeResource) => void | Promise<void>
}

const renderPullAction = (
  resourceCard: SharePanelResourceCard,
  refreshingResources: Record<SyncRuntimeResource, boolean>,
  onRefreshResourceSync: (
    resource: SyncRuntimeResource,
  ) => void | Promise<void>,
) => {
  if (!resourceCard.hasRemoteUpdates) {
    return null
  }

  return (
    <button
      type="button"
      className="sheet-close"
      onClick={() => void onRefreshResourceSync(resourceCard.resource)}
      disabled={refreshingResources[resourceCard.resource]}
    >
      {refreshingResources[resourceCard.resource]
        ? `Pulling ${resourceCard.label.toLowerCase()}...`
        : `Pull ${resourceCard.label.toLowerCase()}`}
    </button>
  )
}

const renderRetryAction = (
  resourceCard: SharePanelResourceCard,
  retryingResources: Record<SyncRuntimeResource, boolean>,
  onRetryResourceSync: (resource: SyncRuntimeResource) => void | Promise<void>,
) => {
  if (!resourceCard.canRetry) {
    return null
  }

  const pendingSuffix =
    resourceCard.pendingCount > 0 ? ` (${resourceCard.pendingCount})` : ''

  return (
    <button
      type="button"
      className="sheet-close"
      onClick={() => void onRetryResourceSync(resourceCard.resource)}
      disabled={retryingResources[resourceCard.resource]}
    >
      {retryingResources[resourceCard.resource]
        ? `Retrying ${resourceCard.label.toLowerCase()}...`
        : `Retry ${resourceCard.label.toLowerCase()}${pendingSuffix}`}
    </button>
  )
}

export const SharePanelResourceGrid = ({
  resourceCards,
  refreshingResources,
  retryingResources,
  onRefreshResourceSync,
  onRetryResourceSync,
}: SharePanelResourceGridProps) => {
  if (resourceCards.length === 0) {
    return null
  }

  return (
    <div className="share-status-resource-grid">
      {resourceCards.map((resourceCard) => (
        <div key={resourceCard.resource} className="share-status-resource-card">
          <div className="share-status-resource-header">
            <div className="share-status-resource-title">{resourceCard.label}</div>
            <div className="share-status-resource-header-meta">
              {resourceCard.hasRemoteUpdates ? (
                <div className="share-status-resource-chip status-warning">
                  Updates available
                </div>
              ) : null}
              {resourceCard.capabilityLabel ? (
                <div className="share-status-resource-chip">
                  {resourceCard.capabilityLabel}
                </div>
              ) : null}
              <div
                className={[
                  'share-status-resource-chip',
                  resourceCard.modeClassName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {resourceCard.modeLabel}
              </div>
              {resourceCard.pendingCount > 0 ? (
                <div className="share-status-resource-count">
                  {resourceCard.pendingCount} pending
                </div>
              ) : null}
            </div>
          </div>
          {resourceCard.note ? (
            <div className="control-meta">{resourceCard.note}</div>
          ) : null}
          {resourceCard.diagnostics.length > 0 ? (
            <div className="share-status-resource-details">
              {resourceCard.diagnostics.map((diagnostic) => (
                <div key={diagnostic} className="control-meta">
                  {diagnostic}
                </div>
              ))}
            </div>
          ) : resourceCard.note ? null : (
            <div className="control-meta">
              {resourceCard.canRetry
                ? 'Remote confirmation is still pending.'
                : 'No current sync warnings.'}
            </div>
          )}
          {renderPullAction(
            resourceCard,
            refreshingResources,
            onRefreshResourceSync,
          )}
          {renderRetryAction(
            resourceCard,
            retryingResources,
            onRetryResourceSync,
          )}
        </div>
      ))}
    </div>
  )
}
