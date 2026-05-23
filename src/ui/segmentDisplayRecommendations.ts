import {
  getParkingSpaceLabel,
  getParkingSpaceMatches,
  type ParkingSpaceCollection,
} from '../data/parkingSpaces'
import { normalizeReportSegmentId, type ReportStatus } from '../feedback/reports'
import { buildNavigationLinks, getSegmentArrivalTarget } from '../map/navigation'
import {
  getAddressRecommendationCandidates,
  getAddressRecommendations,
  sortAddressRecommendationSegments,
  type AddressRecommendationRankMode,
} from './addressRecommendations'
import {
  getAddressRecommendationTargets,
  type AddressRecommendationTarget,
} from './addressRecommendationTargets'
import type { SegmentListItem } from './segmentListTypes'
import type { RecommendationSortableSegment, RouteEtaLike } from './segmentDisplayTypes'

export const MAX_DISPLAY_SEGMENTS = 500

export const buildRecommendationSortableSegments = (
  filteredSegments: SegmentListItem[],
  reportsBySegment: Record<string, { status: ReportStatus }>,
): RecommendationSortableSegment[] =>
  filteredSegments.map((segment) => ({
    ...segment,
    reportStatus: reportsBySegment[normalizeReportSegmentId(segment.id)]?.status ?? null,
  }))

interface BuildSegmentRecommendationDisplayStateOptions {
  recommendationSortableSegments: RecommendationSortableSegment[]
  filteredSegments: SegmentListItem[]
  searchLocation: [number, number] | null
  recommendationRankMode: AddressRecommendationRankMode
  routeEtaBySegmentId: Record<string, RouteEtaLike>
  parkingSpaces: ParkingSpaceCollection
  navigationOrigin: [number, number] | null
  selectedParkingSpaceKeyBySegment: Record<string, string>
}

export const buildSegmentRecommendationDisplayState = ({
  recommendationSortableSegments,
  filteredSegments,
  searchLocation,
  recommendationRankMode,
  routeEtaBySegmentId,
  parkingSpaces,
  navigationOrigin,
  selectedParkingSpaceKeyBySegment,
}: BuildSegmentRecommendationDisplayStateOptions): {
  addressRecommendationCandidates: RecommendationSortableSegment[]
  addressRecommendationTargets: AddressRecommendationTarget<RecommendationSortableSegment>[]
  displaySegments: SegmentListItem[]
  displaySegmentTotalCount: number
  displaySegmentLimit: number
} => {
  if (!searchLocation) {
    return {
      addressRecommendationCandidates: [],
      addressRecommendationTargets: [],
      displaySegments: filteredSegments.slice(0, MAX_DISPLAY_SEGMENTS),
      displaySegmentTotalCount: filteredSegments.length,
      displaySegmentLimit: MAX_DISPLAY_SEGMENTS,
    }
  }

  const addressRecommendationCandidates = getAddressRecommendationCandidates(
    recommendationSortableSegments,
  )
  const addressRecommendations = getAddressRecommendations(
    addressRecommendationCandidates,
    {
      rankMode: recommendationRankMode,
      routeEtaBySegmentId,
    },
  )
  const addressRecommendationTargets = getAddressRecommendationTargets(
    addressRecommendations,
    parkingSpaces,
    searchLocation,
  )

  const baseSegments =
    recommendationSortableSegments.length > 0
      ? sortAddressRecommendationSegments(recommendationSortableSegments, {
          rankMode: recommendationRankMode,
          routeEtaBySegmentId,
        })
      : filteredSegments

  const recommendationBySegmentId = new Map(
    addressRecommendationTargets.map((recommendation) => [
      recommendation.segment.id,
      recommendation,
    ]),
  )

  const displaySegmentTotalCount = baseSegments.length
  const visibleBaseSegments = baseSegments.slice(0, MAX_DISPLAY_SEGMENTS)

  const displaySegments = visibleBaseSegments.map((segment) => {
    const recommendation = recommendationBySegmentId.get(segment.id)
    const preferredTargetKey =
      selectedParkingSpaceKeyBySegment[segment.id] ?? recommendation?.targetKey ?? null
    const parkingSpaceMatches = getParkingSpaceMatches(
      segment.path,
      parkingSpaces,
      navigationOrigin,
    )
    const preferredParkingSpaceMatch = preferredTargetKey
      ? parkingSpaceMatches.find((match) => match.key === preferredTargetKey) ?? null
      : null
    const activeParkingSpaceMatch =
      preferredParkingSpaceMatch ?? parkingSpaceMatches[0] ?? null
    const arrivalTarget = getSegmentArrivalTarget(
      segment.path,
      navigationOrigin,
      activeParkingSpaceMatch?.anchor ?? null,
    )

    return {
      ...segment,
      recommendationRank: recommendation?.rank,
      recommendedTargetLabel: recommendation?.targetLabel ?? null,
      recommendedTargetDescription: recommendation?.description ?? null,
      recommendedTargetMetadata: recommendation?.targetMetadata ?? null,
      recommendedTargetKind: recommendation?.targetKind ?? null,
      recommendedWalkDistanceMeters: recommendation?.walkDistanceMeters ?? null,
      recommendedWalkingDurationSeconds:
        routeEtaBySegmentId[segment.id]?.walkingDurationSeconds ?? null,
      recommendedWalkingEstimated:
        routeEtaBySegmentId[segment.id]?.walkingEstimated ?? false,
      recommendedDrivingDurationSeconds:
        routeEtaBySegmentId[segment.id]?.drivingDurationSeconds ?? null,
      recommendedDrivingEstimated:
        routeEtaBySegmentId[segment.id]?.drivingEstimated ?? false,
      quickActionTargetKey: activeParkingSpaceMatch?.key ?? recommendation?.targetKey ?? null,
      quickActionTargetLabel: activeParkingSpaceMatch
        ? getParkingSpaceLabel(
            activeParkingSpaceMatch.properties,
            arrivalTarget?.label ?? 'Marked space',
          )
        : arrivalTarget?.label ?? null,
      quickActionTargetKind: arrivalTarget?.kind ?? null,
      quickActionNavigationLinks: buildNavigationLinks(
        arrivalTarget?.destination ?? null,
        navigationOrigin,
      ),
    }
  })

  return {
    addressRecommendationCandidates,
    addressRecommendationTargets,
    displaySegments,
    displaySegmentTotalCount,
    displaySegmentLimit: MAX_DISPLAY_SEGMENTS,
  }
}
