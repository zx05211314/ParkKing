import {
  getRoutingRuntimeAvailability,
  isRoutingAvailabilityMessage,
} from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { AddressRecommendationsHeaderProps } from './addressRecommendationsPanelTypes'

export function AddressRecommendationsHeader({
  recommendationRankMode,
  recommendationRankModeLabels,
  addressRecommendationRankingLabel,
  addressRecommendationFeedbackLabel,
  routeEtaStatus,
  routeEtaError,
  navigationOrigin,
  onRecommendationRankModeChange,
}: AddressRecommendationsHeaderProps) {
  const routingAvailability = getRoutingRuntimeAvailability()
  const proactiveRouteEtaNote =
    !routeEtaError &&
    navigationOrigin &&
    recommendationRankMode !== 'DISTANCE' &&
    !routingAvailability.etaAvailable
      ? routingAvailability.etaMessage
      : null
  const routeEtaMessageClass = isRoutingAvailabilityMessage(routeEtaError)
    ? 'control-meta'
    : 'control-meta status-error'

  return (
    <>
      <div className="address-recommendations-header">
        <div className="address-recommendations-heading">
          <div className="control-label">Top nearby parking</div>
        <div className="control-meta">Ranked from the pinned location</div>
          <div className="control-meta">{addressRecommendationRankingLabel}</div>
        </div>
        <div className="address-recommendation-ranking">
          <div className="control-label">Rank by</div>
          <div className="segmented segmented-compact">
            {(Object.entries(recommendationRankModeLabels) as Array<
              [AddressRecommendationRankMode, string]
            >).map(([modeKey, label]) => (
              <button
                key={modeKey}
                type="button"
                className={recommendationRankMode === modeKey ? 'active' : ''}
                disabled={!routingAvailability.etaAvailable && modeKey !== 'DISTANCE'}
                onClick={() => onRecommendationRankModeChange(modeKey)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {routeEtaStatus === 'loading' &&
      navigationOrigin &&
      recommendationRankMode !== 'DISTANCE' ? (
        <div className="control-meta">
          Loading live {recommendationRankMode === 'DRIVE' ? 'drive' : 'walk'} ETA.
          Recommendation order may update.
        </div>
      ) : null}
      {proactiveRouteEtaNote ? (
        <div className="control-meta">ETA note: {proactiveRouteEtaNote}</div>
      ) : null}
      {routeEtaError ? (
        <div className={routeEtaMessageClass}>ETA note: {routeEtaError}</div>
      ) : null}
      {addressRecommendationFeedbackLabel ? (
        <div className="control-meta">{addressRecommendationFeedbackLabel}</div>
      ) : null}
    </>
  )
}
