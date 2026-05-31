import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import { addRecentAddress } from './recentAddresses'
import type { SearchAnchor, ViewMode } from './addressSearchActionTypes'

interface UseAddressSearchSelectionActionsOptions {
  datasetId: string | null
  makeCameraKey: (prefix: string) => string
  resolveDistrictForLocation: (location: [number, number]) => Promise<string | null>
  setAddressQuery: Dispatch<SetStateAction<string>>
  setSearchAnchor: Dispatch<SetStateAction<SearchAnchor | null>>
  setRecentAddressSearches: Dispatch<SetStateAction<GeocodeResult[]>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setActiveView: Dispatch<SetStateAction<ViewMode>>
  setDatasetId: Dispatch<SetStateAction<string | null>>
}

interface UseAddressSearchSelectionActionsResult {
  handleChooseGeocodeResult: (result: GeocodeResult) => Promise<void>
  handleChooseRecentAddress: (result: GeocodeResult) => void
  handleChooseFavoriteAddress: (result: GeocodeResult) => void
}

export const useAddressSearchSelectionActions = ({
  datasetId,
  makeCameraKey,
  resolveDistrictForLocation,
  setAddressQuery,
  setSearchAnchor,
  setRecentAddressSearches,
  setSelectedId,
  setActiveView,
  setDatasetId,
}: UseAddressSearchSelectionActionsOptions): UseAddressSearchSelectionActionsResult => {
  const handleChooseGeocodeResult = useCallback(
    async (result: GeocodeResult) => {
      setAddressQuery(result.label)
      setSearchAnchor({
        key: makeCameraKey(`search:${result.id}`),
        result,
      })
      setRecentAddressSearches((current) => addRecentAddress(current, result))
      setSelectedId(null)
      setActiveView('MAP')

      const nextDistrictId = await resolveDistrictForLocation(result.center)
      if (nextDistrictId && nextDistrictId !== datasetId) {
        setDatasetId(nextDistrictId)
      }
    },
    [
      datasetId,
      makeCameraKey,
      resolveDistrictForLocation,
      setActiveView,
      setAddressQuery,
      setDatasetId,
      setRecentAddressSearches,
      setSearchAnchor,
      setSelectedId,
    ],
  )

  const handleChooseRecentAddress = useCallback(
    (result: GeocodeResult) => {
      void handleChooseGeocodeResult(result)
    },
    [handleChooseGeocodeResult],
  )

  const handleChooseFavoriteAddress = useCallback(
    (result: GeocodeResult) => {
      void handleChooseGeocodeResult(result)
    },
    [handleChooseGeocodeResult],
  )

  return {
    handleChooseGeocodeResult,
    handleChooseRecentAddress,
    handleChooseFavoriteAddress,
  }
}
