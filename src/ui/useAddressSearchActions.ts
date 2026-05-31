import { useCallback } from 'react'
import { resolveDistrictForLocation as resolveDistrictForLocationHelper } from './addressSearchDistrict'
import type {
  UseAddressSearchActionsOptions,
  UseAddressSearchActionsResult,
} from './addressSearchActionTypes'
import { useAddressSearchQueryActions } from './useAddressSearchQueryActions'
import { useAddressSearchSelectionActions } from './useAddressSearchSelectionActions'

export const useAddressSearchActions = ({
  addressQuery,
  datasetId,
  datasetOptions,
  districtBounds,
  datasetMetaFile,
  geocodeRequestIdRef,
  makeCameraKey,
  setAddressQuery,
  setGeocodeResults,
  setGeocodeStatus,
  setGeocodeError,
  setSearchAnchor,
  setRecentAddressSearches,
  setSelectedId,
  setActiveView,
  setDatasetId,
}: UseAddressSearchActionsOptions): UseAddressSearchActionsResult => {
  const resolveDistrictForLocation = useCallback(
    async (
      location: [number, number],
      options: { fallbackToFirst?: boolean } = {},
    ) => {
      return resolveDistrictForLocationHelper({
        datasetMetaFile,
        datasetOptions,
        location,
        fallbackToFirst: options.fallbackToFirst,
      })
    },
    [datasetMetaFile, datasetOptions],
  )

  const {
    handleChooseGeocodeResult,
    handleChooseRecentAddress,
    handleChooseFavoriteAddress,
  } = useAddressSearchSelectionActions({
    datasetId,
    makeCameraKey,
    resolveDistrictForLocation,
    setAddressQuery,
    setSearchAnchor,
    setRecentAddressSearches,
    setSelectedId,
    setActiveView,
    setDatasetId,
  })

  const {
    handleClearAddressSearch,
    handleAddressQueryChange,
    handleAddressSearch,
  } = useAddressSearchQueryActions({
    addressQuery,
    districtBounds,
    geocodeRequestIdRef,
    handleChooseGeocodeResult,
    setAddressQuery,
    setGeocodeResults,
    setGeocodeStatus,
    setGeocodeError,
    setSearchAnchor,
  })

  return {
    resolveDistrictForLocation,
    handleClearAddressSearch,
    handleAddressQueryChange,
    handleChooseGeocodeResult,
    handleChooseRecentAddress,
    handleChooseFavoriteAddress,
    handleAddressSearch,
  }
}
