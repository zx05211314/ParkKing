import type { SegmentSheetNavigationSectionProps } from './segmentSheetNavigationSectionTypes'
import { formatDistance } from './segmentSheetFormatting'

type SegmentSheetParkingSpaceTargetsProps = Pick<
  SegmentSheetNavigationSectionProps,
  | 'parkingSpaceOptions'
  | 'parkingSpaceOptionCount'
  | 'parkingSpaceTargetMode'
  | 'onSelectParkingSpace'
>

export function SegmentSheetParkingSpaceTargets({
  parkingSpaceOptions = [],
  parkingSpaceOptionCount = 0,
  parkingSpaceTargetMode = 'AUTO',
  onSelectParkingSpace,
}: SegmentSheetParkingSpaceTargetsProps) {
  if (parkingSpaceOptions.length === 0 || !onSelectParkingSpace) {
    return null
  }

  return (
    <div className="segment-sheet-space-targets">
      <div className="segment-sheet-label">Exact marked spaces</div>
      <div className="segment-sheet-value">
        {parkingSpaceTargetMode === 'MANUAL'
          ? 'Manual target locked to a marked space.'
          : 'Auto-selecting the nearest marked space from your start point.'}
      </div>
      {parkingSpaceOptionCount > parkingSpaceOptions.length ? (
        <div className="segment-sheet-value">
          Showing {parkingSpaceOptions.length} of {parkingSpaceOptionCount} matched spaces.
        </div>
      ) : null}
      <div className="segment-sheet-actions">
        <button
          type="button"
          className={
            parkingSpaceTargetMode === 'AUTO'
              ? 'segment-space-option active'
              : 'segment-space-option'
          }
          onClick={() => onSelectParkingSpace(null)}
        >
          <span className="segment-space-option-title">Auto</span>
          <span className="segment-space-option-meta">Nearest marked space</span>
        </button>
      </div>
      <div className="segment-space-option-list">
        {parkingSpaceOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={option.active ? 'segment-space-option active' : 'segment-space-option'}
            onClick={() => onSelectParkingSpace(option.key)}
          >
            <span className="segment-space-option-title">{option.label}</span>
            <span className="segment-space-option-meta">{option.description}</span>
            {option.metadata && option.metadata.length > 0 ? (
              <span className="segment-space-option-meta">{option.metadata.join(' | ')}</span>
            ) : null}
            {option.distanceMeters !== null ? (
              <span className="segment-space-option-meta">
                {formatDistance(option.distanceMeters)} from start
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
