import {
  findFavoriteAddress,
  isSameSavedAddress,
} from './recentAddresses'
import type { AddressResultBadgesProps } from './addressSearchPanelTypes'

export function AddressResultBadges({
  result,
  favoriteAddresses,
  favoriteRoleLabels,
  searchAnchor,
  includeRecent = false,
}: AddressResultBadgesProps) {
  const favoriteEntry = findFavoriteAddress(favoriteAddresses, result)
  const badges: Array<{ key: string; label: string; className: string }> = []

  if (favoriteEntry?.role) {
    badges.push({
      key: `role:${favoriteEntry.role}`,
      label: favoriteRoleLabels[favoriteEntry.role],
      className: `search-result-badge role-${favoriteEntry.role.toLowerCase()}`,
    })
  } else if (favoriteEntry) {
    badges.push({
      key: 'favorite',
      label: 'Favorite',
      className: 'search-result-badge favorite',
    })
  } else if (includeRecent) {
    badges.push({
      key: 'recent',
      label: 'Recent',
      className: 'search-result-badge recent',
    })
  }

  if (searchAnchor && isSameSavedAddress(searchAnchor.result, result)) {
    badges.push({
      key: 'pinned',
      label: 'Pinned',
      className: 'search-result-badge pinned',
    })
  }

  if (badges.length === 0) {
    return null
  }

  return (
    <span className="search-result-badges">
      {badges.map((badge) => (
        <span key={badge.key} className={badge.className}>
          {badge.label}
        </span>
      ))}
    </span>
  )
}
