import { getRoutingRuntimeAvailability } from '../map/routing'
import { SegmentSheetParkingSpaceTargets } from './SegmentSheetParkingSpaceTargets'
import { SegmentSheetRouteSummary } from './SegmentSheetRouteSummary'
import type { SegmentSheetNavigationSectionProps } from './segmentSheetNavigationSectionTypes'

export function SegmentSheetNavigationSection({
  navigationLinks,
  navigationSourceLabel,
  arrivalHint,
  navigationTargetKind = 'SEGMENT',
  routeProfile = 'walking',
  routeStatus = 'idle',
  routeError = null,
  onRouteProfileChange,
  parkingSpaceOptions = [],
  parkingSpaceOptionCount = 0,
  parkingSpaceTargetMode = 'AUTO',
  onSelectParkingSpace,
  routeEta,
  walkDistanceMeters,
}: SegmentSheetNavigationSectionProps) {
  if (!navigationLinks) {
    return null
  }
  const routingAvailability = getRoutingRuntimeAvailability()

  return (
    <div className="segment-sheet-section">
      <div className="segment-sheet-label">Go there</div>
      {navigationSourceLabel ? (
        <div className="segment-sheet-value">Start: {navigationSourceLabel}</div>
      ) : null}
      <div className="segment-sheet-value">
        Target: {navigationTargetKind === 'PARKING_SPACE' ? 'Marked space' : 'Curb segment'}
      </div>
      {arrivalHint ? (
        <div className="segment-sheet-value">Arrival: {arrivalHint}</div>
      ) : null}
      <SegmentSheetParkingSpaceTargets
        parkingSpaceOptions={parkingSpaceOptions}
        parkingSpaceOptionCount={parkingSpaceOptionCount}
        parkingSpaceTargetMode={parkingSpaceTargetMode}
        onSelectParkingSpace={onSelectParkingSpace}
      />
      {onRouteProfileChange ? (
        <div className="segment-route-profile">
          <div className="segment-sheet-label">Route on map</div>
          <div className="segmented segmented-compact">
            <button
              type="button"
              className={routeProfile === 'walking' ? 'active' : ''}
              disabled={!routingAvailability.pathAvailable}
              onClick={() => onRouteProfileChange('walking')}
            >
              Walk
            </button>
            <button
              type="button"
              className={routeProfile === 'driving' ? 'active' : ''}
              disabled={!routingAvailability.pathAvailable}
              onClick={() => onRouteProfileChange('driving')}
            >
              Drive
            </button>
          </div>
        </div>
      ) : null}
      <SegmentSheetRouteSummary
        routeProfile={routeProfile}
        routeStatus={routeStatus}
        routeError={routeError}
        routeEta={routeEta}
        walkDistanceMeters={walkDistanceMeters}
      />
      <div className="segment-sheet-actions">
        <a
          className="sheet-close"
          href={navigationLinks.walking}
          target="_blank"
          rel="noreferrer"
          onClick={() => onRouteProfileChange?.('walking')}
        >
          Walk there
        </a>
        <a
          className="sheet-close"
          href={navigationLinks.driving}
          target="_blank"
          rel="noreferrer"
          onClick={() => onRouteProfileChange?.('driving')}
        >
          Drive there
        </a>
      </div>
    </div>
  )
}
