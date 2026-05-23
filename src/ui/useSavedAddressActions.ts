import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import {
  setFavoriteAddressRole,
  toggleFavoriteAddress,
  type FavoriteAddress,
  type FavoriteAddressRole,
} from './recentAddresses'

interface UseSavedAddressActionsOptions {
  setFavoriteAddresses: Dispatch<SetStateAction<FavoriteAddress[]>>
  setRecentAddressSearches: Dispatch<SetStateAction<GeocodeResult[]>>
}

interface UseSavedAddressActionsResult {
  handleToggleFavoriteAddress: (result: GeocodeResult) => void
  handleSetFavoriteAddressRole: (
    result: GeocodeResult,
    role: FavoriteAddressRole,
  ) => void
  handleClearFavoriteAddressRole: (result: GeocodeResult) => void
  handleClearFavoriteAddresses: () => void
  handleClearRecentAddresses: () => void
}

export const useSavedAddressActions = ({
  setFavoriteAddresses,
  setRecentAddressSearches,
}: UseSavedAddressActionsOptions): UseSavedAddressActionsResult => {
  const handleToggleFavoriteAddress = useCallback(
    (result: GeocodeResult) => {
      setFavoriteAddresses((current) => toggleFavoriteAddress(current, result))
    },
    [setFavoriteAddresses],
  )

  const handleSetFavoriteAddressRole = useCallback(
    (result: GeocodeResult, role: FavoriteAddressRole) => {
      setFavoriteAddresses((current) => setFavoriteAddressRole(current, result, role))
    },
    [setFavoriteAddresses],
  )

  const handleClearFavoriteAddressRole = useCallback(
    (result: GeocodeResult) => {
      setFavoriteAddresses((current) => setFavoriteAddressRole(current, result, null))
    },
    [setFavoriteAddresses],
  )

  const handleClearFavoriteAddresses = useCallback(() => {
    setFavoriteAddresses([])
  }, [setFavoriteAddresses])

  const handleClearRecentAddresses = useCallback(() => {
    setRecentAddressSearches([])
  }, [setRecentAddressSearches])

  return {
    handleToggleFavoriteAddress,
    handleSetFavoriteAddressRole,
    handleClearFavoriteAddressRole,
    handleClearFavoriteAddresses,
    handleClearRecentAddresses,
  }
}
