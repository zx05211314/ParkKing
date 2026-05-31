import type { RuntimeSettingsPanelProps } from './runtimeSettingsPanelTypes'

type RuntimeSettingsFilterSectionProps = Pick<
  RuntimeSettingsPanelProps,
  | 'markedSpacesOnly'
  | 'onMarkedSpacesOnlyChange'
  | 'actionFilter'
  | 'actionFilterHiddenCount'
  | 'onActionFilterChange'
  | 'hideReportedIllegal'
  | 'illegalFeedbackHiddenCount'
  | 'onHideReportedIllegalChange'
>

export function RuntimeSettingsFilterSection({
  markedSpacesOnly,
  onMarkedSpacesOnlyChange,
  actionFilter,
  actionFilterHiddenCount,
  onActionFilterChange,
  hideReportedIllegal,
  illegalFeedbackHiddenCount,
  onHideReportedIllegalChange,
}: RuntimeSettingsFilterSectionProps) {
  return (
    <>
      <div className="control-group">
        <div className="control-label">Marked-space filter</div>
        <div className="segmented">
          <button
            type="button"
            className={!markedSpacesOnly ? 'active' : ''}
            onClick={() => onMarkedSpacesOnlyChange(false)}
          >
            All
          </button>
          <button
            type="button"
            className={markedSpacesOnly ? 'active' : ''}
            onClick={() => onMarkedSpacesOnlyChange(true)}
          >
            Spaces only
          </button>
        </div>
        <div className="control-meta">
          {markedSpacesOnly
            ? 'Search, list, and recommendations only show segments with marked spaces.'
            : 'Search, list, and recommendations include all nearby curb segments.'}
        </div>
      </div>
      <div className="control-group">
        <div className="control-label">Legality filter</div>
        <div className="segmented">
          <button
            type="button"
            className={actionFilter === 'ALL' ? 'active' : ''}
            onClick={() => onActionFilterChange('ALL')}
          >
            All
          </button>
          <button
            type="button"
            className={actionFilter === 'STOP_OK' ? 'active' : ''}
            onClick={() => onActionFilterChange('STOP_OK')}
          >
            Stop ok
          </button>
          <button
            type="button"
            className={actionFilter === 'PARK_ONLY' ? 'active' : ''}
            onClick={() => onActionFilterChange('PARK_ONLY')}
          >
            Park ok
          </button>
        </div>
        <div className="control-meta">
          {actionFilter === 'ALL'
            ? 'All nearby curb segments stay visible, including hard no-stop warnings.'
            : actionFilter === 'STOP_OK'
              ? actionFilterHiddenCount > 0
                ? `Hard no-stop segments are hidden from search, list, and recommendations (${actionFilterHiddenCount}).`
                : 'No hard no-stop segments are currently hidden.'
              : actionFilterHiddenCount > 0
                ? `Only full parking-legal segments remain visible (${actionFilterHiddenCount} hidden).`
                : 'Only full parking-legal segments are currently visible.'}
        </div>
      </div>
      <div className="control-group">
        <div className="control-label">Local feedback filter</div>
        <div className="segmented">
          <button
            type="button"
            className={!hideReportedIllegal ? 'active' : ''}
            onClick={() => onHideReportedIllegalChange(false)}
          >
            Show flagged
          </button>
          <button
            type="button"
            className={hideReportedIllegal ? 'active' : ''}
            onClick={() => onHideReportedIllegalChange(true)}
          >
            Hide illegal
          </button>
        </div>
        <div className="control-meta">
          {hideReportedIllegal
            ? illegalFeedbackHiddenCount > 0
              ? `Locally flagged illegal segments are hidden from search, list, and recommendations (${illegalFeedbackHiddenCount}).`
              : 'No locally flagged illegal segments are currently hidden.'
            : 'Locally flagged illegal segments stay visible but are ranked lower.'}
        </div>
      </div>
    </>
  )
}
