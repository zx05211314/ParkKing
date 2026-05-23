import type { RiskMode } from '../domain/ranking/rank'

export const formatFreshness = (value: number | null) => {
  if (value === null) {
    return 'Unknown'
  }
  return `${value} days`
}

export const formatOverrideSource = (value?: string) => {
  if (!value) {
    return null
  }
  if (value === 'segmentId') {
    return 'Segment ID'
  }
  if (value === 'spatial') {
    return 'Spatial match'
  }
  if (value === 'dataset') {
    return 'Dataset'
  }
  return value
}

export const formatOverrideDate = (value?: string) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString()
}

export const formatScore = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '-'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

export const formatDistance = (value?: number | null) => {
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

export const riskModeLabel = (value?: RiskMode) => {
  if (!value) {
    return null
  }
  if (value === 'CONSERVATIVE') {
    return 'Conservative'
  }
  if (value === 'AGGRESSIVE') {
    return 'Aggressive'
  }
  return 'Neutral'
}

export const formatParkingSpaceCount = (value?: number) => {
  if (value === null || value === undefined) {
    return '-'
  }
  return `${value} marked space${value === 1 ? '' : 's'}`
}
