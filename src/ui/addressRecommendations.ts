import { boundsFromPath, type MapBounds } from '../map/bounds'
import {
  compareAddressRecommendationCandidates,
  compareParkingAwareFallback,
} from './addressRecommendationComparators'
import {
  DEFAULT_ADDRESS_RECOMMENDATION_CANDIDATE_LIMIT,
  DEFAULT_ADDRESS_RECOMMENDATION_LIMIT,
} from './addressRecommendationTypes'
import type {
  AddressRecommendation,
  AddressRecommendationCandidate,
  AddressRecommendationCandidateOptions,
  AddressRecommendationOptions,
  AddressRecommendationRankMode,
} from './addressRecommendationTypes'

export {
  DEFAULT_ADDRESS_RECOMMENDATION_CANDIDATE_LIMIT,
  DEFAULT_ADDRESS_RECOMMENDATION_LIMIT,
}
export type {
  AddressRecommendation,
  AddressRecommendationCandidate,
  AddressRecommendationCandidateOptions,
  AddressRecommendationOptions,
  AddressRecommendationRankMode,
}
export type { AddressRecommendationRouteEta } from './addressRecommendationTypes'

export const getAddressRecommendationCandidates = <
  T extends AddressRecommendationCandidate,
>(
  segments: T[],
  options: number | AddressRecommendationCandidateOptions = {},
) => {
  const limit =
    typeof options === 'number'
      ? options
      : options.limit ?? DEFAULT_ADDRESS_RECOMMENDATION_CANDIDATE_LIMIT
  if (limit <= 0) {
    return []
  }

  return [...segments].sort(compareParkingAwareFallback).slice(0, limit)
}

export const sortAddressRecommendationSegments = <
  T extends AddressRecommendationCandidate,
>(
  segments: T[],
  options: Omit<AddressRecommendationOptions, 'limit'> = {},
) => {
  const routeEtaBySegmentId = options.routeEtaBySegmentId ?? {}
  const rankMode = options.rankMode ?? 'WALK'
  return [...segments].sort((left, right) =>
    compareAddressRecommendationCandidates(left, right, routeEtaBySegmentId, rankMode),
  )
}

export const getAddressRecommendations = <T extends AddressRecommendationCandidate>(
  segments: T[],
  options: AddressRecommendationOptions = {},
): AddressRecommendation<T>[] => {
  const limit = options.limit ?? DEFAULT_ADDRESS_RECOMMENDATION_LIMIT
  if (limit <= 0) {
    return []
  }

  const sortedSegments = sortAddressRecommendationSegments(segments, options)

  return sortedSegments.slice(0, limit).map((segment, index) => ({
    rank: index + 1,
    segment,
  }))
}

export const getAddressRecommendationBounds = <
  T extends AddressRecommendationCandidate,
>(
  location: [number, number] | null,
  recommendations: AddressRecommendation<T>[],
): MapBounds | null => {
  if (!location || recommendations.length === 0) {
    return null
  }

  const coordinates: [number, number][] = [
    location,
    ...recommendations.flatMap(({ segment }) => segment.path),
  ]

  return boundsFromPath(coordinates)
}
