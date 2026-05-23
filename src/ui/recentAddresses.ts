export {
  DEFAULT_FAVORITE_ADDRESS_LIMIT,
  DEFAULT_RECENT_ADDRESS_LIMIT,
  type FavoriteAddress,
  type FavoriteAddressRole,
} from './recentAddressTypes'
export {
  addRecentAddress,
  findFavoriteAddress,
  hasSavedAddress,
  normalizeFavoriteAddresses,
  normalizeRecentAddresses,
  setFavoriteAddressRole,
  toggleFavoriteAddress,
  toggleSavedAddress,
} from './recentAddressCollections'
export { getSavedAddressKey, isSameSavedAddress } from './recentAddressNormalization'
