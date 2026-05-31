import type { PrimaryControlsPanelProps } from './primaryControlsPanelTypes'

type PrimaryControlsViewSectionProps = Pick<
  PrimaryControlsPanelProps,
  'activeView' | 'onActiveViewChange' | 'onMapPrefetch'
>

export function PrimaryControlsViewSection({
  activeView,
  onActiveViewChange,
  onMapPrefetch,
}: PrimaryControlsViewSectionProps) {
  return (
    <div className="control-group">
      <div className="control-label">View</div>
      <div className="segmented">
        <button
          type="button"
          className={activeView === 'LIST' ? 'active' : ''}
          onClick={() => onActiveViewChange('LIST')}
        >
          List
        </button>
        <button
          type="button"
          className={activeView === 'MAP' ? 'active' : ''}
          onClick={() => onActiveViewChange('MAP')}
          onFocus={onMapPrefetch}
          onPointerEnter={onMapPrefetch}
        >
          Map
        </button>
      </div>
      <div className="control-meta">
        Mode: {activeView === 'LIST' ? 'List only' : 'Map + list'}
      </div>
    </div>
  )
}
