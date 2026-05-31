import type { RuntimeSettingsPanelProps } from './runtimeSettingsPanelTypes'
import { RuntimeSettingsInferredCandidatesGroup } from './RuntimeSettingsInferredCandidatesGroup'
import { RuntimeSettingsOverlayToggleGroup } from './RuntimeSettingsOverlayToggleGroup'

type RuntimeSettingsOverlaySectionProps = Pick<
  RuntimeSettingsPanelProps,
  | 'showZones'
  | 'onShowZonesChange'
  | 'showIntersectionZones'
  | 'onShowIntersectionZonesChange'
  | 'showCrosswalkZones'
  | 'onShowCrosswalkZonesChange'
  | 'showParkingSpaces'
  | 'onShowParkingSpacesChange'
  | 'parkingSpaceCount'
  | 'actionFilteredMarkedSpaceSegmentCount'
  | 'showInferredCandidates'
  | 'onShowInferredCandidatesChange'
  | 'includeInferred'
  | 'onIncludeInferredChange'
>

export function RuntimeSettingsOverlaySection({
  showZones,
  onShowZonesChange,
  showIntersectionZones,
  onShowIntersectionZonesChange,
  showCrosswalkZones,
  onShowCrosswalkZonesChange,
  showParkingSpaces,
  onShowParkingSpacesChange,
  parkingSpaceCount,
  actionFilteredMarkedSpaceSegmentCount,
  showInferredCandidates,
  onShowInferredCandidatesChange,
  includeInferred,
  onIncludeInferredChange,
}: RuntimeSettingsOverlaySectionProps) {
  return (
    <>
      <RuntimeSettingsOverlayToggleGroup
        label="Zones overlay"
        enabled={showZones}
        onChange={onShowZonesChange}
      />
      <RuntimeSettingsOverlayToggleGroup
        label="Intersection zones"
        enabled={showIntersectionZones}
        onChange={onShowIntersectionZonesChange}
      />
      <RuntimeSettingsOverlayToggleGroup
        label="Crosswalk zones"
        enabled={showCrosswalkZones}
        onChange={onShowCrosswalkZonesChange}
      />
      <RuntimeSettingsOverlayToggleGroup
        label="Parking spaces"
        enabled={showParkingSpaces}
        onChange={onShowParkingSpacesChange}
      >
        <div className="control-meta">Loaded: {parkingSpaceCount}</div>
        <div className="control-meta">
          Nearby with spaces: {actionFilteredMarkedSpaceSegmentCount}
        </div>
      </RuntimeSettingsOverlayToggleGroup>
      <RuntimeSettingsInferredCandidatesGroup
        showInferredCandidates={showInferredCandidates}
        onShowInferredCandidatesChange={onShowInferredCandidatesChange}
        includeInferred={includeInferred}
        onIncludeInferredChange={onIncludeInferredChange}
      />
    </>
  )
}
