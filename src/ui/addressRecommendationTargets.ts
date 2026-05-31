import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import {
  getParkingSpaceLabel,
  getParkingSpaceMatches,
  getParkingSpaceMetadata,
} from '../data/parkingSpaces'
import {
  estimateWalkDistanceMeters,
  getSegmentArrivalTarget,
} from '../map/navigation'
import type {
  AddressRecommendation,
  AddressRecommendationCandidate,
} from './addressRecommendations'

export interface AddressRecommendationTarget<
  T extends AddressRecommendationCandidate,
> extends AddressRecommendation<T> {
  targetKey: string | null
  targetIndex: number | null
  targetKind: 'SEGMENT' | 'PARKING_SPACE'
  targetLabel: string
  targetMetadata: string[]
  destination: [number, number] | null
  description: string | null
  hint: string | null
  walkDistanceMeters: number | null
}

export const getAddressRecommendationTargets = <
  T extends AddressRecommendationCandidate,
>(
  recommendations: AddressRecommendation<T>[],
  parkingSpaces: ParkingSpaceCollection,
  origin: [number, number] | null,
): AddressRecommendationTarget<T>[] => {
  return recommendations.map((recommendation) => {
    const matches = getParkingSpaceMatches(
      recommendation.segment.path,
      parkingSpaces,
      origin,
    )
    const preferredMatch = matches[0] ?? null
    const targetIndex = preferredMatch ? 1 : null
    const arrivalTarget = getSegmentArrivalTarget(
      recommendation.segment.path,
      origin,
      preferredMatch?.anchor ?? null,
    )
    const targetLabel = preferredMatch
      ? getParkingSpaceLabel(preferredMatch.properties, `Space ${targetIndex}`)
      : arrivalTarget?.label ?? 'Target'
    return {
      ...recommendation,
      targetKey: preferredMatch?.key ?? null,
      targetIndex,
      targetKind: arrivalTarget?.kind ?? 'SEGMENT',
      targetLabel,
      targetMetadata: preferredMatch
        ? getParkingSpaceMetadata(preferredMatch.properties)
        : [],
      destination: arrivalTarget?.destination ?? null,
      description: arrivalTarget?.description ?? null,
      hint: arrivalTarget?.hint ?? null,
      walkDistanceMeters: estimateWalkDistanceMeters(
        origin,
        arrivalTarget?.destination ?? null,
      ),
    }
  })
}
