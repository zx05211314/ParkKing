import type { Tier } from './types'

export const tierLabel: Record<Tier, string> = {
  GREEN: 'Green',
  YELLOW: 'Yellow',
  RED: 'Red',
}

export const formatParkingSpaceCount = (value?: number) => {
  if (!value || value <= 0) {
    return null
  }
  return `Spaces ${value}`
}

export const formatWalkDistance = (value?: number | null) => {
  if (value === null || value === undefined) {
    return null
  }
  return `Walk ~${Math.round(value)} m`
}

export const formatEtaDuration = (value?: number | null) => {
  if (value === null || value === undefined) {
    return null
  }
  const roundedMinutes = Math.max(1, Math.round(value / 60))
  return `${roundedMinutes} min`
}

export const formatRecommendationLabel = (rank?: number) => {
  if (!rank) {
    return null
  }
  return rank === 1 ? 'Best exact target' : `Option ${rank}`
}
