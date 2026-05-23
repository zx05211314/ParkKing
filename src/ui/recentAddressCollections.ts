import type { GeocodeResult } from '../map/geocoder'
import {
  DEFAULT_FAVORITE_ADDRESS_LIMIT,
  DEFAULT_RECENT_ADDRESS_LIMIT,
  type FavoriteAddress,
  type FavoriteAddressRole,
} from './recentAddressTypes'
import {
  getSavedAddressKey,
  isSameSavedAddress,
  normalizeFavoriteAddress,
  normalizeSavedAddress,
} from './recentAddressNormalization'

export const normalizeRecentAddresses = (
  value: unknown,
  limit = DEFAULT_RECENT_ADDRESS_LIMIT,
): GeocodeResult[] => {
  if (!Array.isArray(value) || limit <= 0) {
    return []
  }

  const seen = new Set<string>()

  return value
    .flatMap((entry) => {
      const normalized = normalizeSavedAddress(entry)
      if (!normalized) {
        return []
      }

      const key = getSavedAddressKey(normalized)
      if (seen.has(key)) {
        return []
      }
      seen.add(key)
      return [normalized]
    })
    .slice(0, limit)
}

export const addRecentAddress = (
  existing: GeocodeResult[],
  next: GeocodeResult,
  limit = DEFAULT_RECENT_ADDRESS_LIMIT,
): GeocodeResult[] => {
  if (limit <= 0) {
    return []
  }

  return normalizeRecentAddresses([next, ...existing], limit)
}

export const normalizeFavoriteAddresses = (
  value: unknown,
  limit = DEFAULT_FAVORITE_ADDRESS_LIMIT,
): FavoriteAddress[] => {
  if (!Array.isArray(value) || limit <= 0) {
    return []
  }

  const seen = new Set<string>()

  return value
    .flatMap((entry) => {
      const normalized = normalizeFavoriteAddress(entry)
      if (!normalized) {
        return []
      }

      const key = getSavedAddressKey(normalized)
      if (seen.has(key)) {
        return []
      }
      seen.add(key)
      return [normalized]
    })
    .slice(0, limit)
}

export const toggleFavoriteAddress = (
  existing: FavoriteAddress[],
  next: GeocodeResult,
  limit = DEFAULT_FAVORITE_ADDRESS_LIMIT,
): FavoriteAddress[] => {
  if (existing.some((entry) => isSameSavedAddress(entry, next))) {
    return existing.filter((entry) => !isSameSavedAddress(entry, next))
  }

  return normalizeFavoriteAddresses([{ ...next, role: null }, ...existing], limit)
}

export const toggleSavedAddress = toggleFavoriteAddress

export const findFavoriteAddress = (
  existing: ReadonlyArray<FavoriteAddress>,
  candidate: GeocodeResult | null,
): FavoriteAddress | null => {
  if (!candidate) {
    return null
  }

  return existing.find((entry) => isSameSavedAddress(entry, candidate)) ?? null
}

export const setFavoriteAddressRole = (
  existing: FavoriteAddress[],
  candidate: GeocodeResult,
  role: FavoriteAddressRole | null,
  limit = DEFAULT_FAVORITE_ADDRESS_LIMIT,
): FavoriteAddress[] => {
  const current = findFavoriteAddress(existing, candidate)
  if (!current && role === null) {
    return existing
  }

  const remaining = existing
    .filter((entry) => !isSameSavedAddress(entry, candidate))
    .map((entry) =>
      role !== null && entry.role === role ? { ...entry, role: null } : entry,
    )

  const nextEntry: FavoriteAddress = {
    ...(current ?? candidate),
    role,
  }

  return normalizeFavoriteAddresses([nextEntry, ...remaining], limit)
}

export const hasSavedAddress = (
  existing: ReadonlyArray<GeocodeResult>,
  candidate: GeocodeResult | null,
) => {
  if (!candidate) {
    return false
  }

  return existing.some((entry) => isSameSavedAddress(entry, candidate))
}
