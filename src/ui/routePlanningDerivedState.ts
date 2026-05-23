import type { ParkingSpaceMatch } from '../data/parkingSpaces'
import {
  buildNavigationLinks,
  estimateWalkDistanceMeters,
  type SegmentArrivalTarget,
} from '../map/navigation'
import type {
  RecommendationTargetLike,
  SegmentLike,
  SegmentRouteEta,
} from './routePlanningTypes'
import type { SegmentParkingSpaceOption } from './segmentSheetTypes'

export interface BuildRouteTargetSegmentsOptions {
  addressRecommendationCandidates: SegmentLike[]
  maxListRouteTargets: number
  recommendationSortableSegments: SegmentLike[]
  selectedSegment: SegmentLike | null
}

export interface SelectedRoutePlanningDisplayState {
  selectedArrivalHint: string | null
  selectedArrivalKind: 'SEGMENT' | 'PARKING_SPACE'
  selectedArrivalLabel: string | null
  selectedArrivalTarget: SegmentArrivalTarget | null
  selectedCenter: [number, number] | null
  selectedNavigationLinks: ReturnType<typeof buildNavigationLinks>
  selectedRouteEta: SegmentRouteEta | null
  selectedWalkDistance: number | null
}

export interface BestAddressRecommendationRouteDisplayState {
  bestAddressRecommendationArrivalHint: string | null
  bestAddressRecommendationArrivalKind: 'SEGMENT' | 'PARKING_SPACE'
  bestAddressRecommendationCenter: [number, number] | null
  bestAddressRecommendationNavigationLinks: ReturnType<typeof buildNavigationLinks>
  bestAddressRecommendationRouteEta: SegmentRouteEta | null
  bestAddressRecommendationWalkDistance: number | null
}

export const buildRouteTargetSegments = ({
  addressRecommendationCandidates,
  maxListRouteTargets,
  recommendationSortableSegments,
  selectedSegment,
}: BuildRouteTargetSegmentsOptions): SegmentLike[] => {
  const unique = new Map<string, SegmentLike>()
  if (selectedSegment) {
    unique.set(selectedSegment.id, selectedSegment)
  }
  recommendationSortableSegments.slice(0, maxListRouteTargets).forEach((segment) => {
    unique.set(segment.id, segment)
  })
  addressRecommendationCandidates.forEach((segment) => {
    unique.set(segment.id, segment)
  })
  return Array.from(unique.values())
}

export const buildSelectedRoutePlanningDisplayState = ({
  navigationOrigin,
  resolveSegmentArrivalTarget,
  selectedParkingSpaceMatch,
  selectedParkingSpaceOptions,
  selectedSegment,
  selectedTargetRouteEta,
}: {
  navigationOrigin: [number, number] | null
  resolveSegmentArrivalTarget: (
    path: [number, number][],
    origin: [number, number] | null,
    preferredParkingSpaceOverride?: [number, number] | null,
  ) => SegmentArrivalTarget | null
  selectedParkingSpaceMatch: ParkingSpaceMatch | null
  selectedParkingSpaceOptions: SegmentParkingSpaceOption[]
  selectedSegment: SegmentLike | null
  selectedTargetRouteEta: SegmentRouteEta | null
}): SelectedRoutePlanningDisplayState => {
  const selectedArrivalTarget = selectedSegment
    ? resolveSegmentArrivalTarget(
        selectedSegment.path,
        navigationOrigin,
        selectedParkingSpaceMatch?.anchor ?? null,
      )
    : null
  const selectedCenter = selectedArrivalTarget?.destination ?? null
  const selectedArrivalHint = selectedArrivalTarget?.description ?? null
  const selectedArrivalLabel =
    selectedParkingSpaceMatch !== null
      ? selectedParkingSpaceOptions.find((option) => option.key === selectedParkingSpaceMatch.key)
          ?.label ?? selectedArrivalTarget?.label ?? null
      : selectedArrivalTarget?.label ?? null

  return {
    selectedArrivalHint,
    selectedArrivalKind: selectedArrivalTarget?.kind ?? 'SEGMENT',
    selectedArrivalLabel,
    selectedArrivalTarget,
    selectedCenter,
    selectedNavigationLinks: buildNavigationLinks(selectedCenter, navigationOrigin),
    selectedRouteEta: selectedSegment ? selectedTargetRouteEta : null,
    selectedWalkDistance: estimateWalkDistanceMeters(navigationOrigin, selectedCenter),
  }
}

export const buildBestAddressRecommendationRouteDisplayState = ({
  bestAddressRecommendation,
  bestAddressRecommendationTarget,
  navigationOrigin,
  routeEtaBySegmentId,
}: {
  bestAddressRecommendation: SegmentLike | null
  bestAddressRecommendationTarget: RecommendationTargetLike | null
  navigationOrigin: [number, number] | null
  routeEtaBySegmentId: Record<string, SegmentRouteEta>
}): BestAddressRecommendationRouteDisplayState => {
  const bestAddressRecommendationCenter = bestAddressRecommendationTarget?.destination ?? null

  return {
    bestAddressRecommendationArrivalHint:
      bestAddressRecommendationTarget?.description ?? null,
    bestAddressRecommendationArrivalKind:
      bestAddressRecommendationTarget?.targetKind ?? 'SEGMENT',
    bestAddressRecommendationCenter,
    bestAddressRecommendationNavigationLinks: buildNavigationLinks(
      bestAddressRecommendationCenter,
      navigationOrigin,
    ),
    bestAddressRecommendationRouteEta: bestAddressRecommendation
      ? routeEtaBySegmentId[bestAddressRecommendation.id] ?? null
      : null,
    bestAddressRecommendationWalkDistance:
      bestAddressRecommendationTarget?.walkDistanceMeters ?? null,
  }
}
