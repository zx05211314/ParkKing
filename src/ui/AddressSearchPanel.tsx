import { hasSavedAddress } from './recentAddresses'
import { AddressQuickPlaces } from './AddressQuickPlaces'
import { AddressSearchHeader } from './AddressSearchHeader'
import { AddressSearchResultListSection } from './AddressSearchResultListSection'
import type { AddressSearchPanelProps } from './addressSearchPanelTypes'

export function AddressSearchPanel({
  addressInputRef,
  addressQuery,
  geocodeStatus,
  geocodeError,
  geocodeResultsCount,
  activeDistanceLabel,
  locationStatus,
  searchLocationLabel,
  searchAnchor,
  searchActionCount,
  isPinnedFavorite,
  pinnedFavoriteRole,
  favoriteRoleLabels,
  favoriteAddresses,
  quickFavoriteAddresses,
  visibleGeocodeResults,
  visibleFavoriteAddresses,
  visibleRecentAddresses,
  favoriteAddressOffset,
  recentAddressOffset,
  registerSearchActionRef,
  onAddressQueryChange,
  onAddressInputKeyDown,
  onAddressSearch,
  onClearAddressSearch,
  onToggleFavoriteAddress,
  onSetFavoriteAddressRole,
  onClearFavoriteAddressRole,
  onChooseGeocodeResult,
  onChooseFavoriteAddress,
  onClearFavoriteAddresses,
  onChooseRecentAddress,
  onClearRecentAddresses,
  onSearchActionKeyDown,
  children,
}: AddressSearchPanelProps) {
  return (
    <div className="control-group control-group-search">
      <AddressSearchHeader
        addressInputRef={addressInputRef}
        addressQuery={addressQuery}
        geocodeStatus={geocodeStatus}
        geocodeError={geocodeError}
        geocodeResultsCount={geocodeResultsCount}
        activeDistanceLabel={activeDistanceLabel}
        locationStatus={locationStatus}
        searchLocationLabel={searchLocationLabel}
        searchAnchor={searchAnchor}
        searchActionCount={searchActionCount}
        isPinnedFavorite={isPinnedFavorite}
        pinnedFavoriteRole={pinnedFavoriteRole}
        favoriteRoleLabels={favoriteRoleLabels}
        favoriteAddresses={favoriteAddresses}
        onAddressQueryChange={onAddressQueryChange}
        onAddressInputKeyDown={onAddressInputKeyDown}
        onAddressSearch={onAddressSearch}
        onClearAddressSearch={onClearAddressSearch}
        onToggleFavoriteAddress={onToggleFavoriteAddress}
        onSetFavoriteAddressRole={onSetFavoriteAddressRole}
        onClearFavoriteAddressRole={onClearFavoriteAddressRole}
      />
      <AddressQuickPlaces
        quickFavoriteAddresses={quickFavoriteAddresses}
        searchAnchor={searchAnchor}
        favoriteRoleLabels={favoriteRoleLabels}
        onChooseFavoriteAddress={onChooseFavoriteAddress}
      />
      <AddressSearchResultListSection
        results={visibleGeocodeResults}
        baseIndex={0}
        searchAnchor={searchAnchor}
        favoriteAddresses={favoriteAddresses}
        favoriteRoleLabels={favoriteRoleLabels}
        registerSearchActionRef={registerSearchActionRef}
        onSearchActionKeyDown={onSearchActionKeyDown}
        onChooseResult={onChooseGeocodeResult}
        onToggleFavoriteAddress={onToggleFavoriteAddress}
        getActionLabel={(result) => (hasSavedAddress(favoriteAddresses, result) ? 'Remove' : 'Save')}
      />
      <AddressSearchResultListSection
        title="Favorite addresses"
        meta="Pinned places you want to keep"
        clearLabel="Clear favorites"
        results={visibleFavoriteAddresses}
        baseIndex={favoriteAddressOffset}
        searchAnchor={searchAnchor}
        favoriteAddresses={favoriteAddresses}
        favoriteRoleLabels={favoriteRoleLabels}
        registerSearchActionRef={registerSearchActionRef}
        onSearchActionKeyDown={onSearchActionKeyDown}
        onChooseResult={onChooseFavoriteAddress}
        onToggleFavoriteAddress={onToggleFavoriteAddress}
        onClear={onClearFavoriteAddresses}
        getActionLabel={() => 'Remove'}
      />
      <AddressSearchResultListSection
        title="Recent addresses"
          meta="Reuse a previous pinned location"
        clearLabel="Clear recents"
        results={visibleRecentAddresses}
        baseIndex={recentAddressOffset}
        searchAnchor={searchAnchor}
        favoriteAddresses={favoriteAddresses}
        favoriteRoleLabels={favoriteRoleLabels}
        registerSearchActionRef={registerSearchActionRef}
        onSearchActionKeyDown={onSearchActionKeyDown}
        onChooseResult={onChooseRecentAddress}
        onToggleFavoriteAddress={onToggleFavoriteAddress}
        onClear={onClearRecentAddresses}
        getActionLabel={(result) => (hasSavedAddress(favoriteAddresses, result) ? 'Remove' : 'Save')}
        includeRecentBadges={true}
      />
      {children}
    </div>
  )
}
