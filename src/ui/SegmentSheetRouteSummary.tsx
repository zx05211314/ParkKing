import {
  getRoutingRuntimeAvailability,
  isRoutingAvailabilityMessage,
} from '../map/routing'
import type { SegmentSheetNavigationSectionProps } from './segmentSheetNavigationSectionTypes'
import { formatDistance, formatEtaDuration } from './segmentSheetFormatting'

type SegmentSheetRouteSummaryProps = Pick<
  SegmentSheetNavigationSectionProps,
  'routeProfile' | 'routeStatus' | 'routeError' | 'routeEta' | 'walkDistanceMeters'
>

export function SegmentSheetRouteSummary({
  routeProfile = 'walking',
  routeStatus = 'idle',
  routeError = null,
  routeEta,
  walkDistanceMeters,
}: SegmentSheetRouteSummaryProps) {
  const routingAvailability = getRoutingRuntimeAvailability()
  const proactiveRouteError =
    !routeError && !routingAvailability.pathAvailable
      ? routingAvailability.pathMessage
      : null
  const routeMessage = routeError ?? proactiveRouteError
  const routeErrorClass = isRoutingAvailabilityMessage(routeError)
    ? 'segment-sheet-value'
    : 'segment-sheet-value status-error'
  const routeMessageClass = isRoutingAvailabilityMessage(routeMessage)
    ? 'segment-sheet-value'
    : 'segment-sheet-value status-error'

  return (
    <>
      {routeStatus === 'loading' ? (
        <div className="segment-sheet-value">
          Loading {routeProfile === 'walking' ? 'walk' : 'drive'} route on map...
        </div>
      ) : null}
      {routeMessage ? (
        <div className={routeMessage === routeError ? routeErrorClass : routeMessageClass}>
          Map route: {routeMessage}
        </div>
      ) : null}
      {routeEta?.walkingDurationSeconds !== null &&
      routeEta?.walkingDurationSeconds !== undefined ? (
        <div className="segment-sheet-value">
          {routeEta.walkingEstimated ? 'Walk ETA (estimated): ' : 'Walk ETA: '}
          {formatEtaDuration(routeEta.walkingDurationSeconds)}
          {routeEta.walkingDistanceMeters !== null ? (
            <> | {formatDistance(routeEta.walkingDistanceMeters)}</>
          ) : null}
        </div>
      ) : walkDistanceMeters !== null && walkDistanceMeters !== undefined ? (
        <div className="segment-sheet-value">
          Est. walk: {formatDistance(walkDistanceMeters)}
        </div>
      ) : null}
      {routeEta?.drivingDurationSeconds !== null &&
      routeEta?.drivingDurationSeconds !== undefined ? (
        <div className="segment-sheet-value">
          {routeEta.drivingEstimated ? 'Drive ETA (estimated): ' : 'Drive ETA: '}
          {formatEtaDuration(routeEta.drivingDurationSeconds)}
          {routeEta.drivingDistanceMeters !== null ? (
            <> | {formatDistance(routeEta.drivingDistanceMeters)}</>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
