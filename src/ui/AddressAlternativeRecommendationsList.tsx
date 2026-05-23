import { estimateWalkDistanceMeters } from '../map/navigation'
import { normalizeReportSegmentId } from '../feedback/reports'
import { formatSegmentFeedbackSummary } from './feedbackSummary'
import type { AddressAlternativeRecommendationsListProps } from './addressRecommendationsPanelTypes'

export function AddressAlternativeRecommendationsList({
  alternativeAddressRecommendations,
  routeEtaBySegmentId,
  reportsBySegment,
  searchLocation,
  selectedId,
  alternativeRecommendationOffset,
  registerSearchActionRef,
  formatDistanceMeters,
  formatParkingSpaceCount,
  formatWalkDistanceMeters,
  formatRouteDistanceMeters,
  formatEtaDuration,
  formatRecommendationLabel,
  onSearchActionKeyDown,
  onSelectAddressRecommendation,
}: AddressAlternativeRecommendationsListProps) {
  if (alternativeAddressRecommendations.length === 0) {
    return null
  }

  return (
    <>
      <div className="control-meta">Other nearby options</div>
      <div className="address-recommendations-list">
        {alternativeAddressRecommendations.map((recommendation, altIndex) => {
          const { rank, segment } = recommendation
          const parkingSpaceLabel = formatParkingSpaceCount(segment.parkingSpaceCount)
          const segmentRouteEta = routeEtaBySegmentId[segment.id] ?? null
          const segmentReport =
            reportsBySegment[normalizeReportSegmentId(segment.id)] ?? null
          const segmentFeedback = formatSegmentFeedbackSummary(segmentReport)

          return (
            <button
              key={segment.id}
              type="button"
              ref={(element) =>
                registerSearchActionRef(alternativeRecommendationOffset + altIndex, element)
              }
              className={
                segment.id === selectedId
                  ? 'address-recommendation active'
                  : 'address-recommendation'
              }
              onKeyDown={(event) => {
                const combinedIndex = alternativeRecommendationOffset + altIndex
                onSearchActionKeyDown(event, combinedIndex)
              }}
              onClick={() =>
                onSelectAddressRecommendation(segment.id, recommendation.targetKey)
              }
            >
              <div className="address-recommendation-rank">
                {formatRecommendationLabel(rank)}
              </div>
              <div className="address-recommendation-main">
                <div className="address-recommendation-title">{segment.name}</div>
                <div className="address-recommendation-meta">
                  <span>{segment.tier}</span>
                  <span>{segment.allowedNow.replace('_', ' ')}</span>
                  {segment.sourceType === 'INFERRED' ? <span>Inferred</span> : null}
                  <span>{formatDistanceMeters(segment.distanceMeters)}</span>
                  {parkingSpaceLabel ? <span>{parkingSpaceLabel}</span> : null}
                  <span>
                    {recommendation.targetKind === 'PARKING_SPACE'
                      ? recommendation.targetLabel
                      : 'Curb target'}
                  </span>
                  {segmentRouteEta?.walkingDurationSeconds !== null &&
                  segmentRouteEta?.walkingDurationSeconds !== undefined ? (
                    <span>
                      {segmentRouteEta.walkingEstimated ? 'Walk ~' : 'Walk '}
                      {formatEtaDuration(segmentRouteEta.walkingDurationSeconds)}
                      {segmentRouteEta.walkingDistanceMeters !== null
                        ? ` / ${formatRouteDistanceMeters(
                            segmentRouteEta.walkingDistanceMeters,
                          )}`
                        : ''}
                    </span>
                  ) : searchLocation ? (
                    <span>
                      {formatWalkDistanceMeters(
                        estimateWalkDistanceMeters(
                          searchLocation,
                          recommendation.destination,
                        ),
                      )}
                    </span>
                  ) : null}
                </div>
                {recommendation.description ? (
                  <div className="address-recommendation-target">
                    {recommendation.description}
                  </div>
                ) : null}
                {recommendation.targetMetadata.length > 0 ? (
                  <div className="address-recommendation-target-meta">
                    {recommendation.targetMetadata.join(' | ')}
                  </div>
                ) : null}
                {segmentFeedback && segmentReport ? (
                  <div className={`feedback-badge feedback-${segmentReport.status.toLowerCase()}`}>
                    {segmentFeedback}
                  </div>
                ) : null}
              </div>
              <div className="address-recommendation-action">Open</div>
            </button>
          )
        })}
      </div>
    </>
  )
}
