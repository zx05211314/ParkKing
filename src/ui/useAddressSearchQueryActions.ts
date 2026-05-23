import { useCallback } from 'react'
import type {
  Dispatch,
  FormEvent,
  MutableRefObject,
  SetStateAction,
} from 'react'
import type { MapBounds } from '../map/bounds'
import { searchAddresses, type GeocodeResult } from '../map/geocoder'
import type {
  GeocodeStatus,
  SearchAnchor,
  UseAddressSearchActionsResult,
} from './addressSearchActionTypes'

interface UseAddressSearchQueryActionsOptions {
  addressQuery: string
  districtBounds: MapBounds | null
  geocodeRequestIdRef: MutableRefObject<number>
  handleChooseGeocodeResult: UseAddressSearchActionsResult['handleChooseGeocodeResult']
  setAddressQuery: Dispatch<SetStateAction<string>>
  setGeocodeResults: Dispatch<SetStateAction<GeocodeResult[]>>
  setGeocodeStatus: Dispatch<SetStateAction<GeocodeStatus>>
  setGeocodeError: Dispatch<SetStateAction<string | null>>
  setSearchAnchor: Dispatch<SetStateAction<SearchAnchor | null>>
}

interface UseAddressSearchQueryActionsResult {
  handleClearAddressSearch: () => void
  handleAddressQueryChange: (value: string) => void
  handleAddressSearch: (event?: FormEvent<HTMLFormElement>) => Promise<void>
}

export const useAddressSearchQueryActions = ({
  addressQuery,
  districtBounds,
  geocodeRequestIdRef,
  handleChooseGeocodeResult,
  setAddressQuery,
  setGeocodeResults,
  setGeocodeStatus,
  setGeocodeError,
  setSearchAnchor,
}: UseAddressSearchQueryActionsOptions): UseAddressSearchQueryActionsResult => {
  const clearSearchState = useCallback(
    (options?: { clearAddressQuery?: boolean }) => {
      geocodeRequestIdRef.current += 1
      setGeocodeResults([])
      setGeocodeStatus('idle')
      setGeocodeError(null)
      setSearchAnchor(null)
      if (options?.clearAddressQuery) {
        setAddressQuery('')
      }
    },
    [
      geocodeRequestIdRef,
      setAddressQuery,
      setGeocodeError,
      setGeocodeResults,
      setGeocodeStatus,
      setSearchAnchor,
    ],
  )

  const handleAddressQueryChange = useCallback(
    (value: string) => {
      setAddressQuery(value)
      clearSearchState()
    },
    [clearSearchState, setAddressQuery],
  )

  const handleClearAddressSearch = useCallback(() => {
    clearSearchState({ clearAddressQuery: true })
  }, [clearSearchState])

  const handleAddressSearch = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      const trimmedQuery = addressQuery.trim()
      if (!trimmedQuery) {
        clearSearchState()
        return
      }

      const requestId = geocodeRequestIdRef.current + 1
      geocodeRequestIdRef.current = requestId
      setGeocodeStatus('searching')
      setGeocodeError(null)
      setGeocodeResults([])
      setSearchAnchor(null)

      try {
        const results = await searchAddresses(trimmedQuery, {
          biasBounds: districtBounds,
        })
        if (geocodeRequestIdRef.current !== requestId) {
          return
        }

        setGeocodeResults(results)
        setGeocodeStatus('ready')
        if (results.length === 0) {
          setGeocodeError(
            `No address results for "${trimmedQuery}". Local road and segment filtering is still active.`,
          )
          return
        }

        if (results.length === 1) {
          void handleChooseGeocodeResult(results[0])
        }
      } catch (error) {
        if (geocodeRequestIdRef.current !== requestId) {
          return
        }

        setGeocodeStatus('error')
        setGeocodeError(
          error instanceof Error
            ? `${error.message} Local road and segment filtering is still active.`
            : 'Address search failed. Local road and segment filtering is still active.',
        )
      }
    },
    [
      addressQuery,
      clearSearchState,
      districtBounds,
      geocodeRequestIdRef,
      handleChooseGeocodeResult,
      setGeocodeError,
      setGeocodeResults,
      setGeocodeStatus,
      setSearchAnchor,
    ],
  )

  return {
    handleClearAddressSearch,
    handleAddressQueryChange,
    handleAddressSearch,
  }
}
