import type { AddressBestRecommendationCardProps } from './addressRecommendationsPanelTypes'
import {
  getParkingSpaceBackedReason,
  isParkingSpaceBackedGreenSegment,
} from './parkingEvidencePresentation'

export function AddressBestRecommendationCard({
  bestAddressRecommendation,
  bestAddressRecommendationTarget,
  bestAddressRecommendationReason,
  bestAddressRecommendationFeedback,
  bestAddressRecommendationReport,
  bestAddressRecommendationArrivalHint,
  bestAddressRecommendationArrivalKind,
  bestAddressRecommendationWalkDistance,
  bestAddressRecommendationNavigationLinks,
  bestAddressRecommendationRouteEta,
  selectedId,
  bestRecommendationIndex,
  registerSearchActionRef,
  formatDistanceMeters,
  formatParkingSpaceCount,
  formatWalkDistanceMeters,
  formatRouteDistanceMeters,
  formatEtaDuration,
  onSearchActionKeyDown,
  onSelectAddressRecommendation,
  onSaveBestRecommendationPlan,
  onNavigateToRecommendation,
}: AddressBestRecommendationCardProps) {
  if (!bestAddressRecommendation || !bestAddressRecommendationTarget) {
    return null
  }

  const parkingSpaceLabel = formatParkingSpaceCount(
    bestAddressRecommendation.parkingSpaceCount,
  )
  const isSpaceBacked = isParkingSpaceBackedGreenSegment(bestAddressRecommendation)
  const parkingEvidenceReason = getParkingSpaceBackedReason(bestAddressRecommendation)
  const resolvedReason = bestAddressRecommendationReason ?? parkingEvidenceReason

  return (
    <div className="address-best-option">
      <div className="address-best-option-label">Best exact target</div>
      <div className="address-best-option-title">{bestAddressRecommendation.name}</div>
      <div className="address-best-option-meta">
        <span>{bestAddressRecommendation.tier}</span>
        <span>{bestAddressRecommendation.allowedNow.replace('_', ' ')}</span>
        {bestAddressRecommendation.sourceType === 'INFERRED' ? <span>Inferred</span> : null}
        {isSpaceBacked ? <span>Space-backed</span> : null}
        <span>{formatDistanceMeters(bestAddressRecommendation.distanceMeters)}</span>
        {parkingSpaceLabel ? <span>{parkingSpaceLabel}</span> : null}
        {bestAddressRecommendationRouteEta?.walkingDurationSeconds !== null &&
        bestAddressRecommendationRouteEta?.walkingDurationSeconds !== undefined ? (
          <span>
            {bestAddressRecommendationRouteEta.walkingEstimated ? 'Walk ~' : 'Walk '}
            {formatEtaDuration(bestAddressRecommendationRouteEta.walkingDurationSeconds)}
            {bestAddressRecommendationRouteEta.walkingDistanceMeters !== null
              ? ` / ${formatRouteDistanceMeters(
                  bestAddressRecommendationRouteEta.walkingDistanceMeters,
                )}`
              : ''}
          </span>
        ) : bestAddressRecommendationWalkDistance !== null ? (
          <span>{formatWalkDistanceMeters(bestAddressRecommendationWalkDistance)}</span>
        ) : null}
        {bestAddressRecommendationRouteEta?.drivingDurationSeconds !== null &&
        bestAddressRecommendationRouteEta?.drivingDurationSeconds !== undefined ? (
          <span>
            {bestAddressRecommendationRouteEta.drivingEstimated ? 'Drive ~' : 'Drive '}
            {formatEtaDuration(bestAddressRecommendationRouteEta.drivingDurationSeconds)}
            {bestAddressRecommendationRouteEta.drivingDistanceMeters !== null
              ? ` / ${formatRouteDistanceMeters(
                  bestAddressRecommendationRouteEta.drivingDistanceMeters,
                )}`
              : ''}
          </span>
        ) : null}
      </div>
      {resolvedReason ? (
        <div className="address-best-option-reason">Why: {resolvedReason}</div>
      ) : null}
      {bestAddressRecommendationFeedback && bestAddressRecommendationReport ? (
        <div
          className={`feedback-badge feedback-${bestAddressRecommendationReport.status.toLowerCase()}`}
        >
          {bestAddressRecommendationFeedback}
        </div>
      ) : null}
      {bestAddressRecommendationArrivalHint ? (
        <div className="address-best-option-arrival">
          Arrival: {bestAddressRecommendationArrivalHint}
        </div>
      ) : null}
      <div className="address-best-option-arrival">
        Exact target: {bestAddressRecommendationTarget.targetLabel}
      </div>
      {bestAddressRecommendationTarget.targetMetadata.length > 0 ? (
        <div className="address-best-option-target-meta">
          {bestAddressRecommendationTarget.targetMetadata.join(' | ')}
        </div>
      ) : null}
      <div className="address-best-option-arrival">
        Target type:{' '}
        {bestAddressRecommendationArrivalKind === 'PARKING_SPACE'
          ? 'Marked space'
          : 'Curb segment'}
      </div>
      <div className="address-best-option-actions">
        <button
          type="button"
          className="sheet-close"
          ref={(element) => registerSearchActionRef(bestRecommendationIndex, element)}
          onKeyDown={(event) => onSearchActionKeyDown(event, bestRecommendationIndex)}
          onClick={() =>
            onSelectAddressRecommendation(
              bestAddressRecommendation.id,
              bestAddressRecommendationTarget.targetKey,
            )
          }
        >
          {selectedId === bestAddressRecommendation.id
            ? 'Best target selected'
            : 'Open best target'}
        </button>
        <button type="button" className="sheet-close" onClick={onSaveBestRecommendationPlan}>
          Save target
        </button>
        {bestAddressRecommendationNavigationLinks ? (
          <>
            <a
              className="sheet-close"
              href={bestAddressRecommendationNavigationLinks.walking}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                onNavigateToRecommendation(
                  bestAddressRecommendation.id,
                  'walking',
                  bestAddressRecommendationTarget.targetKey,
                )
              }
            >
              Walk there
            </a>
            <a
              className="sheet-close"
              href={bestAddressRecommendationNavigationLinks.driving}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                onNavigateToRecommendation(
                  bestAddressRecommendation.id,
                  'driving',
                  bestAddressRecommendationTarget.targetKey,
                )
              }
            >
              Drive there
            </a>
          </>
        ) : null}
      </div>
    </div>
  )
}
