import { AddressAlternativeRecommendationsList } from './AddressAlternativeRecommendationsList'
import { AddressBestRecommendationCard } from './AddressBestRecommendationCard'
import { AddressNearbySnapshot } from './AddressNearbySnapshot'
import { AddressParkingAnswerSummary } from './AddressParkingAnswerSummary'
import { AddressRecommendationsHeader } from './AddressRecommendationsHeader'
import type { AddressRecommendationsPanelProps } from './addressRecommendationsPanelTypes'

export function AddressRecommendationsPanel({
  hasPinnedAddress,
  recommendationRankMode,
  recommendationRankModeLabels,
  addressRecommendationRankingLabel,
  addressRecommendationFeedbackLabel,
  parkingAnswer,
  parkingAnswerServiceStatus,
  parkingAnswerServiceError,
  parkingCoverageNotice,
  parkingCoverageReferenceState,
  parkingCoverageReferenceAddressLabel,
  selectedPaidCurbReferenceId,
  parkingAnswerReport,
  nearbySnapshot,
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
  alternativeAddressRecommendations,
  addressRecommendationEmptyMessage,
  routeEtaStatus,
  routeEtaError,
  routeEtaBySegmentId,
  reportsBySegment,
  navigationOrigin,
  searchLocation,
  selectedId,
  bestRecommendationIndex,
  alternativeRecommendationOffset,
  registerSearchActionRef,
  formatDistanceMeters,
  formatParkingSpaceCount,
  formatWalkDistanceMeters,
  formatRouteDistanceMeters,
  formatEtaDuration,
  formatRecommendationLabel,
  onSearchActionKeyDown,
  onRecommendationRankModeChange,
  onParkingAnswerReport,
  onSelectPaidCurbReference,
  onSelectAddressRecommendation,
  onSaveBestRecommendationPlan,
  onNavigateToRecommendation,
}: AddressRecommendationsPanelProps) {
  if (!hasPinnedAddress) {
    return null
  }

  const recommendationEmptyMessage = parkingCoverageNotice
    ? 'Parking recommendations are hidden because the pinned location is outside the active dataset.'
    : parkingAnswer?.primary
      ? 'Exact curb answer is shown above. Route-ranked parking targets are unavailable with the current filters or route data.'
      : addressRecommendationEmptyMessage

  return (
    <div className="address-recommendations">
      <AddressRecommendationsHeader
        recommendationRankMode={recommendationRankMode}
        recommendationRankModeLabels={recommendationRankModeLabels}
        addressRecommendationRankingLabel={addressRecommendationRankingLabel}
        addressRecommendationFeedbackLabel={addressRecommendationFeedbackLabel}
        routeEtaStatus={routeEtaStatus}
        routeEtaError={routeEtaError}
        navigationOrigin={navigationOrigin}
        onRecommendationRankModeChange={onRecommendationRankModeChange}
      />
      <AddressParkingAnswerSummary
        parkingAnswer={parkingAnswer}
        parkingAnswerServiceStatus={parkingAnswerServiceStatus}
        parkingAnswerServiceError={parkingAnswerServiceError}
        parkingCoverageNotice={parkingCoverageNotice}
        parkingCoverageReferenceState={parkingCoverageReferenceState}
        parkingCoverageReferenceAddressLabel={
          parkingCoverageReferenceAddressLabel
        }
        selectedPaidCurbReferenceId={selectedPaidCurbReferenceId}
        parkingAnswerReport={parkingAnswerReport}
        formatDistanceMeters={formatDistanceMeters}
        onParkingAnswerReport={onParkingAnswerReport}
        onSelectPaidCurbReference={onSelectPaidCurbReference}
      />
      {parkingCoverageNotice ||
      !bestAddressRecommendation ||
      !bestAddressRecommendationTarget ? (
        <div className="control-meta">{recommendationEmptyMessage}</div>
      ) : (
        <>
          <AddressNearbySnapshot nearbySnapshot={nearbySnapshot} />
          <AddressBestRecommendationCard
            bestAddressRecommendation={bestAddressRecommendation}
            bestAddressRecommendationTarget={bestAddressRecommendationTarget}
            bestAddressRecommendationReason={bestAddressRecommendationReason}
            bestAddressRecommendationFeedback={bestAddressRecommendationFeedback}
            bestAddressRecommendationReport={bestAddressRecommendationReport}
            bestAddressRecommendationArrivalHint={bestAddressRecommendationArrivalHint}
            bestAddressRecommendationArrivalKind={bestAddressRecommendationArrivalKind}
            bestAddressRecommendationWalkDistance={bestAddressRecommendationWalkDistance}
            bestAddressRecommendationNavigationLinks={bestAddressRecommendationNavigationLinks}
            bestAddressRecommendationRouteEta={bestAddressRecommendationRouteEta}
            selectedId={selectedId}
            bestRecommendationIndex={bestRecommendationIndex}
            registerSearchActionRef={registerSearchActionRef}
            formatDistanceMeters={formatDistanceMeters}
            formatParkingSpaceCount={formatParkingSpaceCount}
            formatWalkDistanceMeters={formatWalkDistanceMeters}
            formatRouteDistanceMeters={formatRouteDistanceMeters}
            formatEtaDuration={formatEtaDuration}
            onSearchActionKeyDown={onSearchActionKeyDown}
            onSelectAddressRecommendation={onSelectAddressRecommendation}
            onSaveBestRecommendationPlan={onSaveBestRecommendationPlan}
            onNavigateToRecommendation={onNavigateToRecommendation}
          />
          <AddressAlternativeRecommendationsList
            alternativeAddressRecommendations={alternativeAddressRecommendations}
            routeEtaBySegmentId={routeEtaBySegmentId}
            reportsBySegment={reportsBySegment}
            searchLocation={searchLocation}
            selectedId={selectedId}
            alternativeRecommendationOffset={alternativeRecommendationOffset}
            registerSearchActionRef={registerSearchActionRef}
            formatDistanceMeters={formatDistanceMeters}
            formatParkingSpaceCount={formatParkingSpaceCount}
            formatWalkDistanceMeters={formatWalkDistanceMeters}
            formatRouteDistanceMeters={formatRouteDistanceMeters}
            formatEtaDuration={formatEtaDuration}
            formatRecommendationLabel={formatRecommendationLabel}
            onSearchActionKeyDown={onSearchActionKeyDown}
            onSelectAddressRecommendation={onSelectAddressRecommendation}
          />
        </>
      )}
    </div>
  )
}
