import type {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from 'react'
import type { GeocodeResult } from '../map/geocoder'
import type {
  FavoriteAddress,
  FavoriteAddressRole,
} from './recentAddresses'
import type { ResolvedLocationStatus } from './resolvedLocationState'

export interface AddressSearchPanelProps {
  addressInputRef: RefObject<HTMLInputElement | null>
  addressQuery: string
  geocodeStatus: 'idle' | 'searching' | 'ready' | 'error'
  geocodeError: string | null
  geocodeResultsCount: number
  activeDistanceLabel: string
  locationStatus: ResolvedLocationStatus
  searchLocationLabel: string | null
  searchAnchor: { result: GeocodeResult } | null
  searchActionCount: number
  isPinnedFavorite: boolean
  pinnedFavoriteRole: FavoriteAddressRole | null
  favoriteRoleLabels: Record<FavoriteAddressRole, string>
  favoriteAddresses: FavoriteAddress[]
  quickFavoriteAddresses: FavoriteAddress[]
  visibleGeocodeResults: GeocodeResult[]
  visibleFavoriteAddresses: FavoriteAddress[]
  visibleRecentAddresses: GeocodeResult[]
  favoriteAddressOffset: number
  recentAddressOffset: number
  registerSearchActionRef: (index: number, element: HTMLButtonElement | null) => void
  onAddressQueryChange: (value: string) => void
  onAddressInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onAddressSearch: (event: FormEvent<HTMLFormElement>) => void
  onClearAddressSearch: () => void
  onToggleFavoriteAddress: (result: GeocodeResult) => void
  onSetFavoriteAddressRole: (
    result: GeocodeResult,
    role: FavoriteAddressRole,
  ) => void
  onClearFavoriteAddressRole: (result: GeocodeResult) => void
  onChooseGeocodeResult: (result: GeocodeResult) => Promise<void>
  onChooseFavoriteAddress: (result: FavoriteAddress) => void
  onClearFavoriteAddresses: () => void
  onChooseRecentAddress: (result: GeocodeResult) => void
  onClearRecentAddresses: () => void
  onSearchActionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
  children?: ReactNode
}

export interface AddressResultBadgesProps {
  result: GeocodeResult
  favoriteAddresses: FavoriteAddress[]
  favoriteRoleLabels: Record<FavoriteAddressRole, string>
  searchAnchor: { result: GeocodeResult } | null
  includeRecent?: boolean
}
