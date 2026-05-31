import { useState } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import { readSetting, STORAGE_KEYS } from '../settings'
import {
  DEFAULT_FAVORITE_ADDRESS_LIMIT,
  normalizeFavoriteAddresses,
  normalizeRecentAddresses,
} from './recentAddresses'
import type { SearchAnchor, UseAppSearchUiStateOptions } from './appUiStateTypes'

export const useAppSearchUiState = ({
  initialSharedState,
}: UseAppSearchUiStateOptions) => {
  const [addressQuery, setAddressQuery] = useState(
    initialSharedState.searchResult?.label ?? '',
  )
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult[]>([])
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'searching' | 'ready' | 'error'>(
    'idle',
  )
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [searchAnchor, setSearchAnchor] = useState<SearchAnchor | null>(() =>
    initialSharedState.searchResult
      ? {
          key: `share:${initialSharedState.searchResult.id}`,
          result: initialSharedState.searchResult,
        }
      : null,
  )
  const [favoriteAddresses, setFavoriteAddresses] = useState(() =>
    normalizeFavoriteAddresses(
      readSetting<unknown>(STORAGE_KEYS.favoriteAddresses, []),
      DEFAULT_FAVORITE_ADDRESS_LIMIT,
    ),
  )
  const [recentAddressSearches, setRecentAddressSearches] = useState<GeocodeResult[]>(() =>
    normalizeRecentAddresses(
      readSetting<unknown>(STORAGE_KEYS.recentAddressSearches, []),
    ),
  )

  return {
    addressQuery,
    favoriteAddresses,
    geocodeError,
    geocodeResults,
    geocodeStatus,
    recentAddressSearches,
    searchAnchor,
    setAddressQuery,
    setFavoriteAddresses,
    setGeocodeError,
    setGeocodeResults,
    setGeocodeStatus,
    setRecentAddressSearches,
    setSearchAnchor,
  }
}
