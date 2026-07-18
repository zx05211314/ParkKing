import type { KeyboardEvent } from 'react'
import type { ParkingAnswer } from '../domain/answers/parkingAnswer'
import type { ReportStatus, SegmentReport } from '../feedback/reports'
import type { ParkingAnswerServiceStatus } from './useParkingAnswerServiceState'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type {
  NavigationLinksLike,
  RecommendationSegmentLike,
  RecommendationTargetLike,
  RouteEtaStatus,
  SegmentRouteEtaLike,
} from './addressRecommendationDisplayTypes'
import type { NearbySnapshot } from './recommendationDisplaySnapshot'
import type { PaidCurbReferenceState } from './usePaidCurbReferenceState'

export interface AddressRecommendationsPanelProps {
  hasPinnedAddress: boolean
  recommendationRankMode: AddressRecommendationRankMode
  recommendationRankModeLabels: Record<AddressRecommendationRankMode, string>
  addressRecommendationRankingLabel: string
  addressRecommendationFeedbackLabel: string | null
  parkingAnswer: ParkingAnswer | null
  parkingAnswerServiceStatus: ParkingAnswerServiceStatus
  parkingAnswerServiceError: string | null
  parkingCoverageNotice: string | null
  parkingCoverageReferenceState?: PaidCurbReferenceState | null
  parkingCoverageReferenceAddressLabel?: string | null
  selectedPaidCurbReferenceId?: string | null
  parkingAnswerReport: SegmentReport | null
  nearbySnapshot: NearbySnapshot | null
  bestAddressRecommendation: RecommendationSegmentLike | null
  bestAddressRecommendationTarget: RecommendationTargetLike | null
  bestAddressRecommendationReason: string | null
  bestAddressRecommendationFeedback: string | null
  bestAddressRecommendationReport: SegmentReport | null
  bestAddressRecommendationArrivalHint: string | null
  bestAddressRecommendationArrivalKind: 'SEGMENT' | 'PARKING_SPACE'
  bestAddressRecommendationWalkDistance: number | null
  bestAddressRecommendationNavigationLinks: NavigationLinksLike | null
  bestAddressRecommendationRouteEta: SegmentRouteEtaLike | null
  alternativeAddressRecommendations: RecommendationTargetLike[]
  addressRecommendationEmptyMessage: string
  routeEtaStatus: RouteEtaStatus
  routeEtaError: string | null
  routeEtaBySegmentId: Record<string, SegmentRouteEtaLike>
  reportsBySegment: Record<string, SegmentReport>
  navigationOrigin: [number, number] | null
  searchLocation: [number, number] | null
  selectedId: string | null
  bestRecommendationIndex: number
  alternativeRecommendationOffset: number
  registerSearchActionRef: (index: number, element: HTMLButtonElement | null) => void
  formatDistanceMeters: (value?: number) => string
  formatParkingSpaceCount: (value?: number | null) => string | null
  formatWalkDistanceMeters: (value?: number | null) => string
  formatRouteDistanceMeters: (value?: number | null) => string
  formatEtaDuration: (value?: number | null) => string | null
  formatRecommendationLabel: (rank: number) => string
  onSearchActionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
  onRecommendationRankModeChange: (value: AddressRecommendationRankMode) => void
  onParkingAnswerReport: (status: ReportStatus, note: string) => void
  onSelectPaidCurbReference?: (parkingSegmentId: string) => void
  onSelectAddressRecommendation: (segmentId: string, targetKey?: string | null) => void
  onSaveBestRecommendationPlan: () => void
  onNavigateToRecommendation: (
    segmentId: string,
    profile: 'walking' | 'driving',
    targetKey?: string | null,
  ) => void
}

export type AddressRecommendationsHeaderProps = Pick<
  AddressRecommendationsPanelProps,
  | 'recommendationRankMode'
  | 'recommendationRankModeLabels'
  | 'addressRecommendationRankingLabel'
  | 'addressRecommendationFeedbackLabel'
  | 'routeEtaStatus'
  | 'routeEtaError'
  | 'navigationOrigin'
  | 'onRecommendationRankModeChange'
>

export type AddressNearbySnapshotProps = Pick<
  AddressRecommendationsPanelProps,
  'nearbySnapshot'
>

export type AddressParkingAnswerSummaryProps = Pick<
  AddressRecommendationsPanelProps,
  | 'parkingAnswer'
  | 'parkingAnswerServiceStatus'
  | 'parkingAnswerServiceError'
  | 'parkingCoverageNotice'
  | 'parkingCoverageReferenceState'
  | 'parkingCoverageReferenceAddressLabel'
  | 'selectedPaidCurbReferenceId'
  | 'parkingAnswerReport'
  | 'formatDistanceMeters'
  | 'onParkingAnswerReport'
  | 'onSelectPaidCurbReference'
>

export type AddressBestRecommendationCardProps = Pick<
  AddressRecommendationsPanelProps,
  | 'bestAddressRecommendation'
  | 'bestAddressRecommendationTarget'
  | 'bestAddressRecommendationReason'
  | 'bestAddressRecommendationFeedback'
  | 'bestAddressRecommendationReport'
  | 'bestAddressRecommendationArrivalHint'
  | 'bestAddressRecommendationArrivalKind'
  | 'bestAddressRecommendationWalkDistance'
  | 'bestAddressRecommendationNavigationLinks'
  | 'bestAddressRecommendationRouteEta'
  | 'selectedId'
  | 'bestRecommendationIndex'
  | 'registerSearchActionRef'
  | 'formatDistanceMeters'
  | 'formatParkingSpaceCount'
  | 'formatWalkDistanceMeters'
  | 'formatRouteDistanceMeters'
  | 'formatEtaDuration'
  | 'onSearchActionKeyDown'
  | 'onSelectAddressRecommendation'
  | 'onSaveBestRecommendationPlan'
  | 'onNavigateToRecommendation'
>

export type AddressAlternativeRecommendationsListProps = Pick<
  AddressRecommendationsPanelProps,
  | 'alternativeAddressRecommendations'
  | 'routeEtaBySegmentId'
  | 'reportsBySegment'
  | 'searchLocation'
  | 'selectedId'
  | 'alternativeRecommendationOffset'
  | 'registerSearchActionRef'
  | 'formatDistanceMeters'
  | 'formatParkingSpaceCount'
  | 'formatWalkDistanceMeters'
  | 'formatRouteDistanceMeters'
  | 'formatEtaDuration'
  | 'formatRecommendationLabel'
  | 'onSearchActionKeyDown'
  | 'onSelectAddressRecommendation'
>
