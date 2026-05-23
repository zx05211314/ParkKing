import { AddressResultBadges } from './AddressResultBadges'
import type { AddressSearchPanelProps } from './addressSearchPanelTypes'

type AddressSearchHeaderProps = Pick<
  AddressSearchPanelProps,
  | 'addressInputRef'
  | 'addressQuery'
  | 'geocodeStatus'
  | 'geocodeError'
  | 'geocodeResultsCount'
  | 'activeDistanceLabel'
  | 'locationStatus'
  | 'searchLocationLabel'
  | 'searchAnchor'
  | 'searchActionCount'
  | 'isPinnedFavorite'
  | 'pinnedFavoriteRole'
  | 'favoriteRoleLabels'
  | 'favoriteAddresses'
  | 'onAddressQueryChange'
  | 'onAddressInputKeyDown'
  | 'onAddressSearch'
  | 'onClearAddressSearch'
  | 'onToggleFavoriteAddress'
  | 'onSetFavoriteAddressRole'
  | 'onClearFavoriteAddressRole'
>

export function AddressSearchHeader({
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
  onAddressQueryChange,
  onAddressInputKeyDown,
  onAddressSearch,
  onClearAddressSearch,
  onToggleFavoriteAddress,
  onSetFavoriteAddressRole,
  onClearFavoriteAddressRole,
}: AddressSearchHeaderProps) {
  const locationStatusMessage =
    !searchLocationLabel && locationStatus === 'locating'
      ? 'Trying to resolve device location. You can still search an address now.'
      : !searchLocationLabel && locationStatus === 'unavailable'
        ? 'Device location unavailable. Search an address or switch to Mock to rank nearby segments.'
        : null

  return (
    <>
      <div className="control-label">Find address</div>
      <form className="search-form" onSubmit={onAddressSearch}>
        <div className="control-input">
          <input
            ref={addressInputRef}
            type="search"
            value={addressQuery}
            placeholder="Address or place"
            onChange={(event) => onAddressQueryChange(event.target.value)}
            onKeyDown={onAddressInputKeyDown}
          />
        </div>
        <div className="search-actions">
          <button
            type="submit"
            className="sheet-close"
            disabled={!addressQuery.trim() || geocodeStatus === 'searching'}
          >
            {geocodeStatus === 'searching' ? 'Finding...' : 'Find address'}
          </button>
          {(addressQuery.trim().length > 0 ||
            searchAnchor ||
            geocodeResultsCount > 0 ||
            geocodeError) && (
            <button
              type="button"
              className="sheet-close"
              onClick={onClearAddressSearch}
            >
              Clear
            </button>
          )}
        </div>
      </form>
      <div className="control-meta">Distance anchor: {activeDistanceLabel}</div>
      {searchLocationLabel ? (
        <div className="control-meta">Pinned location: {searchLocationLabel}</div>
      ) : null}
      {locationStatusMessage ? (
        <div className="control-meta">{locationStatusMessage}</div>
      ) : null}
      {searchAnchor ? (
        <div className="address-status-row">
          <AddressResultBadges
            result={searchAnchor.result}
            favoriteAddresses={favoriteAddresses}
            favoriteRoleLabels={favoriteRoleLabels}
            searchAnchor={searchAnchor}
          />
        </div>
      ) : null}
      {searchAnchor ? (
        <div className="search-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onToggleFavoriteAddress(searchAnchor.result)}
          >
            {isPinnedFavorite ? 'Remove favorite' : 'Save favorite'}
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onSetFavoriteAddressRole(searchAnchor.result, 'HOME')}
          >
            {pinnedFavoriteRole === 'HOME' ? 'Home saved' : 'Set home'}
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onSetFavoriteAddressRole(searchAnchor.result, 'WORK')}
          >
            {pinnedFavoriteRole === 'WORK' ? 'Work saved' : 'Set work'}
          </button>
          {pinnedFavoriteRole ? (
            <button
              type="button"
              className="address-recommendations-action"
              onClick={() => onClearFavoriteAddressRole(searchAnchor.result)}
            >
              Clear label
            </button>
          ) : null}
        </div>
      ) : null}
      {geocodeStatus === 'searching' ? (
        <div className="control-meta">Searching address results...</div>
      ) : null}
      {geocodeError ? <div className="control-meta status-error">{geocodeError}</div> : null}
      {searchActionCount > 0 ? (
        <div className="control-meta">
          Keyboard: Up/Down moves through matches, favorites, recent addresses, and
          nearby options. Esc returns to the address field.
        </div>
      ) : null}
    </>
  )
}
