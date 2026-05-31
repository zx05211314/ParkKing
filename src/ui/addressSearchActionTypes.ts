import type { Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react'
import type { MapBounds } from '../map/bounds'
import type { GeocodeResult } from '../map/geocoder'

export type GeocodeStatus = 'idle' | 'searching' | 'ready' | 'error'
export type SearchAnchor = { key: string; result: GeocodeResult }
export type ViewMode = 'LIST' | 'MAP'
export type DatasetOption = { id: string; label: string }

export interface UseAddressSearchActionsOptions {
  addressQuery: string
  datasetId: string | null
  datasetOptions: DatasetOption[]
  districtBounds: MapBounds | null
  datasetMetaFile: string
  geocodeRequestIdRef: MutableRefObject<number>
  makeCameraKey: (prefix: string) => string
  setAddressQuery: Dispatch<SetStateAction<string>>
  setGeocodeResults: Dispatch<SetStateAction<GeocodeResult[]>>
  setGeocodeStatus: Dispatch<SetStateAction<GeocodeStatus>>
  setGeocodeError: Dispatch<SetStateAction<string | null>>
  setSearchAnchor: Dispatch<SetStateAction<SearchAnchor | null>>
  setRecentAddressSearches: Dispatch<SetStateAction<GeocodeResult[]>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setActiveView: Dispatch<SetStateAction<ViewMode>>
  setDatasetId: Dispatch<SetStateAction<string | null>>
}

export interface UseAddressSearchActionsResult {
  resolveDistrictForLocation: (
    location: [number, number],
    options?: { fallbackToFirst?: boolean },
  ) => Promise<string | null>
  handleClearAddressSearch: () => void
  handleAddressQueryChange: (value: string) => void
  handleChooseGeocodeResult: (result: GeocodeResult) => Promise<void>
  handleChooseRecentAddress: (result: GeocodeResult) => void
  handleChooseFavoriteAddress: (result: GeocodeResult) => void
  handleAddressSearch: (event?: FormEvent<HTMLFormElement>) => Promise<void>
}
