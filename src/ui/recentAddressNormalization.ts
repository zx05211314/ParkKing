import type { GeocodeResult } from '../map/geocoder'
import type { FavoriteAddress, FavoriteAddressRole } from './recentAddressTypes'

const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isCenter = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  isCoordinate(value[0]) &&
  isCoordinate(value[1])

const isBounds = (value: unknown): value is [[number, number], [number, number]] =>
  Array.isArray(value) &&
  value.length === 2 &&
  isCenter(value[0]) &&
  isCenter(value[1])

export const getSavedAddressKey = (result: GeocodeResult) =>
  `${result.label}|${result.center[0].toFixed(6)}|${result.center[1].toFixed(6)}`

export const isSameSavedAddress = (left: GeocodeResult, right: GeocodeResult) =>
  getSavedAddressKey(left) === getSavedAddressKey(right)

export const isFavoriteAddressRole = (value: unknown): value is FavoriteAddressRole =>
  value === 'HOME' || value === 'WORK'

export const normalizeSavedAddress = (value: unknown): GeocodeResult | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<GeocodeResult>
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
  if (!label || !isCenter(candidate.center)) {
    return null
  }

  const id =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id
      : getSavedAddressKey({
          id: label,
          label,
          center: candidate.center,
          bounds: null,
        })

  return {
    id,
    label,
    center: candidate.center,
    bounds: isBounds(candidate.bounds) ? candidate.bounds : null,
  }
}

export const normalizeFavoriteAddress = (value: unknown): FavoriteAddress | null => {
  const normalized = normalizeSavedAddress(value)
  if (!normalized) {
    return null
  }

  const candidate = value as Partial<FavoriteAddress>
  return {
    ...normalized,
    role: isFavoriteAddressRole(candidate.role) ? candidate.role : null,
  }
}
