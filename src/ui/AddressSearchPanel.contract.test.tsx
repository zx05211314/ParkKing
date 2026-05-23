import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AddressSearchPanel } from './AddressSearchPanel'
import type { FavoriteAddress } from './recentAddresses'
import type { AddressSearchPanelProps } from './addressSearchPanelTypes'

const homeFavorite: FavoriteAddress = {
  id: 'home',
  label: '1 Civic Blvd',
  center: [121.565, 25.033],
  bounds: null,
  role: 'HOME',
}

const workFavorite: FavoriteAddress = {
  id: 'work',
  label: '2 Civic Blvd',
  center: [121.566, 25.034],
  bounds: null,
  role: 'WORK',
}

const recentAddress = {
  id: 'recent',
  label: '3 Civic Blvd',
  center: [121.567, 25.035] as [number, number],
  bounds: null,
}

const baseProps: AddressSearchPanelProps = {
  addressInputRef: createRef<HTMLInputElement>(),
  addressQuery: 'civic',
  geocodeStatus: 'ready',
  geocodeError: null,
  geocodeResultsCount: 2,
  activeDistanceLabel: 'Pinned location',
  locationStatus: 'device',
  searchLocationLabel: '1 Civic Blvd',
  searchAnchor: { result: homeFavorite },
  searchActionCount: 4,
  isPinnedFavorite: true,
  pinnedFavoriteRole: 'HOME',
  favoriteRoleLabels: {
    HOME: 'Home',
    WORK: 'Work',
  },
  favoriteAddresses: [homeFavorite, workFavorite],
  quickFavoriteAddresses: [homeFavorite, workFavorite],
  visibleGeocodeResults: [recentAddress],
  visibleFavoriteAddresses: [homeFavorite, workFavorite],
  visibleRecentAddresses: [recentAddress],
  favoriteAddressOffset: 5,
  recentAddressOffset: 10,
  registerSearchActionRef: () => {},
  onAddressQueryChange: () => {},
  onAddressInputKeyDown: () => {},
  onAddressSearch: () => {},
  onClearAddressSearch: () => {},
  onToggleFavoriteAddress: () => {},
  onSetFavoriteAddressRole: () => {},
  onClearFavoriteAddressRole: () => {},
  onChooseGeocodeResult: async () => {},
  onChooseFavoriteAddress: () => {},
  onClearFavoriteAddresses: () => {},
  onChooseRecentAddress: () => {},
  onClearRecentAddresses: () => {},
  onSearchActionKeyDown: () => {},
  children: <div>Recommendation content</div>,
}

describe('AddressSearchPanel contract', () => {
  it('renders search controls, quick places, favorites, recents, and child content', () => {
    const html = renderToStaticMarkup(<AddressSearchPanel {...baseProps} />)

    expect(html).toContain('Find address')
    expect(html).toContain('Distance anchor: Pinned location')
    expect(html).toContain('Pinned location: 1 Civic Blvd')
    expect(html).toContain('Remove favorite')
    expect(html).toContain('Set work')
    expect(html).toContain('Quick places')
    expect(html).toContain('Favorite addresses')
    expect(html).toContain('Clear favorites')
    expect(html).toContain('Recent addresses')
    expect(html).toContain('Clear recents')
    expect(html).toContain('Pinned')
    expect(html).toContain('Recent')
    expect(html).toContain('Recommendation content')
  })

  it('renders a recovery hint when device location is unavailable', () => {
    const html = renderToStaticMarkup(
      <AddressSearchPanel
        {...baseProps}
        activeDistanceLabel="Unavailable"
        locationStatus="unavailable"
        searchLocationLabel={null}
        searchAnchor={null}
      />,
    )

    expect(html).toContain('Distance anchor: Unavailable')
    expect(html).toContain(
      'Device location unavailable. Search an address or switch to Mock to rank nearby segments.',
    )
  })
})
