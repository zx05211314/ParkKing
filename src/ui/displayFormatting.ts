import type { AllowedAction } from './types'
import type { FavoriteAddressRole } from './recentAddresses'

export const FALLBACK_DATASET_OPTIONS = [
  { id: 'xinyi', label: 'Xinyi' },
  { id: 'daan', label: 'Daan' },
  { id: 'zhongshan', label: 'Zhongshan' },
]

export const FAVORITE_ROLE_LABELS: Record<FavoriteAddressRole, string> = {
  HOME: 'Home',
  WORK: 'Work',
}

export const FAVORITE_ROLE_ORDER: Record<FavoriteAddressRole, number> = {
  HOME: 0,
  WORK: 1,
}

export const formatMetaDate = (value?: string) => {
  if (!value) {
    return '-'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '-'
  }
  return parsed.toLocaleString()
}

export const formatDistanceMeters = (value?: number) => {
  if (value === undefined) {
    return '-'
  }
  return `${Math.round(value)} m`
}

export const formatParkingSpaceCount = (value?: number | null) => {
  if (!value || value <= 0) {
    return null
  }
  return `${value} space${value === 1 ? '' : 's'}`
}

export const formatWalkDistanceMeters = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-'
  }
  return `Walk ~${Math.round(value)} m`
}

export const formatRouteDistanceMeters = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-'
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`
  }
  return `${Math.round(value)} m`
}

export const formatEtaDuration = (value?: number | null) => {
  if (value === null || value === undefined) {
    return null
  }
  const roundedMinutes = Math.max(1, Math.round(value / 60))
  if (roundedMinutes >= 60) {
    const hours = Math.floor(roundedMinutes / 60)
    const minutes = roundedMinutes % 60
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`
  }
  return `${roundedMinutes} min`
}

export const formatRecommendationLabel = (rank: number) => {
  if (rank === 1) {
    return 'Best nearby'
  }
  return `Option ${rank}`
}

export const formatSavedPlanTimestamp = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

export const getAllowedActionLabel = (value: AllowedAction) => value.replace('_', ' ')
