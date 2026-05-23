import {
  getSavedAddressKey,
  isSameSavedAddress,
} from './recentAddresses'
import type { AddressSearchPanelProps } from './addressSearchPanelTypes'

type AddressQuickPlacesProps = Pick<
  AddressSearchPanelProps,
  | 'quickFavoriteAddresses'
  | 'searchAnchor'
  | 'favoriteRoleLabels'
  | 'onChooseFavoriteAddress'
>

export function AddressQuickPlaces({
  quickFavoriteAddresses,
  searchAnchor,
  favoriteRoleLabels,
  onChooseFavoriteAddress,
}: AddressQuickPlacesProps) {
  if (quickFavoriteAddresses.length === 0) {
    return null
  }

  return (
    <div className="address-recommendations">
      <div className="address-recommendations-heading">
        <div className="control-label">Quick places</div>
        <div className="control-meta">Saved home and work shortcuts</div>
      </div>
      <div className="quick-place-list">
        {quickFavoriteAddresses.map((result) => (
          <button
            key={getSavedAddressKey(result)}
            type="button"
            className={
              searchAnchor && isSameSavedAddress(searchAnchor.result, result)
                ? 'quick-place-button active'
                : 'quick-place-button'
            }
            onClick={() => onChooseFavoriteAddress(result)}
          >
            <span className={`quick-place-role role-${result.role?.toLowerCase()}`}>
              {result.role ? favoriteRoleLabels[result.role] : 'Saved'}
            </span>
            <span className="quick-place-label">{result.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
