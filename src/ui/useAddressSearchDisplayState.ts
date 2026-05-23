import { useMemo } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import { FAVORITE_ROLE_ORDER } from './displayFormatting'
import {
  DEFAULT_FAVORITE_ADDRESS_LIMIT,
  DEFAULT_RECENT_ADDRESS_LIMIT,
  hasSavedAddress,
  type FavoriteAddress,
} from './recentAddresses'

interface UseAddressSearchDisplayStateOptions {
  geocodeResults: GeocodeResult[]
  favoriteAddresses: FavoriteAddress[]
  recentAddressSearches: GeocodeResult[]
  hasBestAddressRecommendation: boolean
  alternativeRecommendationCount: number
}

interface UseAddressSearchDisplayStateResult {
  visibleGeocodeResults: GeocodeResult[]
  visibleFavoriteAddresses: FavoriteAddress[]
  quickFavoriteAddresses: FavoriteAddress[]
  visibleRecentAddresses: GeocodeResult[]
  favoriteAddressOffset: number
  recentAddressOffset: number
  bestRecommendationIndex: number
  alternativeRecommendationOffset: number
  searchActionCount: number
}

export const useAddressSearchDisplayState = ({
  geocodeResults,
  favoriteAddresses,
  recentAddressSearches,
  hasBestAddressRecommendation,
  alternativeRecommendationCount,
}: UseAddressSearchDisplayStateOptions): UseAddressSearchDisplayStateResult => {
  const visibleGeocodeResults = useMemo(() => geocodeResults.slice(0, 4), [geocodeResults])

  const visibleFavoriteAddresses = useMemo(() => {
    if (visibleGeocodeResults.length > 0) {
      return []
    }
    return favoriteAddresses.slice(0, DEFAULT_FAVORITE_ADDRESS_LIMIT)
  }, [favoriteAddresses, visibleGeocodeResults])

  const quickFavoriteAddresses = useMemo(() => {
    if (visibleGeocodeResults.length > 0) {
      return []
    }

    return favoriteAddresses
      .filter((entry) => entry.role !== null)
      .sort((left, right) => {
        if (left.role === null || right.role === null) {
          return 0
        }
        return FAVORITE_ROLE_ORDER[left.role] - FAVORITE_ROLE_ORDER[right.role]
      })
      .slice(0, 2)
  }, [favoriteAddresses, visibleGeocodeResults])

  const visibleRecentAddresses = useMemo(() => {
    if (visibleGeocodeResults.length > 0) {
      return []
    }
    return recentAddressSearches
      .filter((entry) => !hasSavedAddress(favoriteAddresses, entry))
      .slice(0, DEFAULT_RECENT_ADDRESS_LIMIT)
  }, [favoriteAddresses, recentAddressSearches, visibleGeocodeResults])

  const favoriteAddressOffset = visibleGeocodeResults.length
  const recentAddressOffset = favoriteAddressOffset + visibleFavoriteAddresses.length
  const bestRecommendationIndex =
    visibleGeocodeResults.length +
    visibleFavoriteAddresses.length +
    visibleRecentAddresses.length
  const alternativeRecommendationOffset =
    bestRecommendationIndex + (hasBestAddressRecommendation ? 1 : 0)
  const searchActionCount =
    visibleGeocodeResults.length +
    visibleFavoriteAddresses.length +
    visibleRecentAddresses.length +
    (hasBestAddressRecommendation ? 1 : 0) +
    alternativeRecommendationCount

  return {
    visibleGeocodeResults,
    visibleFavoriteAddresses,
    quickFavoriteAddresses,
    visibleRecentAddresses,
    favoriteAddressOffset,
    recentAddressOffset,
    bestRecommendationIndex,
    alternativeRecommendationOffset,
    searchActionCount,
  }
}
