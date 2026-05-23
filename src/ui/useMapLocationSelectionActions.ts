import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import { buildMapPinGeocodeResult } from './mapPinGeocode'
import type { GeocodeStatus, SearchAnchor } from './appUiStateTypes'

interface UseMapLocationSelectionActionsOptions {
  datasetId: string | null
  geocodeRequestIdRef: MutableRefObject<number>
  makeCameraKey: (prefix: string) => string
  resolveDistrictForLocation: (location: [number, number]) => Promise<string | null>
  setAddressQuery: Dispatch<SetStateAction<string>>
  setGeocodeResults: Dispatch<SetStateAction<GeocodeResult[]>>
  setGeocodeStatus: Dispatch<SetStateAction<GeocodeStatus>>
  setGeocodeError: Dispatch<SetStateAction<string | null>>
  setSearchAnchor: Dispatch<SetStateAction<SearchAnchor | null>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setActiveView: Dispatch<SetStateAction<'LIST' | 'MAP'>>
  setDatasetId: Dispatch<SetStateAction<string | null>>
}

export const useMapLocationSelectionActions = ({
  datasetId,
  geocodeRequestIdRef,
  makeCameraKey,
  resolveDistrictForLocation,
  setAddressQuery,
  setGeocodeResults,
  setGeocodeStatus,
  setGeocodeError,
  setSearchAnchor,
  setSelectedId,
  setActiveView,
  setDatasetId,
}: UseMapLocationSelectionActionsOptions) =>
  useCallback(
    (location: [number, number]) => {
      const result = buildMapPinGeocodeResult(location)
      const requestId = geocodeRequestIdRef.current + 1
      geocodeRequestIdRef.current = requestId

      setAddressQuery(result.label)
      setGeocodeResults([])
      setGeocodeStatus('idle')
      setGeocodeError(null)
      setSearchAnchor({
        key: makeCameraKey(result.id),
        result,
      })
      setSelectedId(null)
      setActiveView('MAP')

      void resolveDistrictForLocation(location).then((nextDistrictId) => {
        if (geocodeRequestIdRef.current !== requestId) {
          return
        }
        if (nextDistrictId && nextDistrictId !== datasetId) {
          setDatasetId(nextDistrictId)
        }
      })
    },
    [
      datasetId,
      geocodeRequestIdRef,
      makeCameraKey,
      resolveDistrictForLocation,
      setActiveView,
      setAddressQuery,
      setDatasetId,
      setGeocodeError,
      setGeocodeResults,
      setGeocodeStatus,
      setSearchAnchor,
      setSelectedId,
    ],
  )
