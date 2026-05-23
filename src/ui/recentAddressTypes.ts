import type { GeocodeResult } from '../map/geocoder'

export const DEFAULT_RECENT_ADDRESS_LIMIT = 5
export const DEFAULT_FAVORITE_ADDRESS_LIMIT = 6

export type FavoriteAddressRole = 'HOME' | 'WORK'

export interface FavoriteAddress extends GeocodeResult {
  role: FavoriteAddressRole | null
}
