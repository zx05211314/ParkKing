import type { SyncRuntimeResource } from '../api/syncRuntimeStatus'

export const SYNC_STATUS_RESOURCE_LABELS: Record<SyncRuntimeResource, string> = {
  savedPlans: 'saved plans',
  reports: 'reports',
  issueReports: 'issue reports',
}

export const capitalizeSentence = (value: string) =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value

export const formatRetrySourceLabel = (value: 'auto' | 'manual' | null) =>
  value === 'manual' ? 'manual retry' : 'auto retry'

export const parseTimestampMs = (value: string | null) => {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

export const formatRelativeAge = (timestampMs: number, nowMs: number) => {
  const elapsedMs = Math.max(0, nowMs - timestampMs)
  if (elapsedMs < 60_000) {
    return 'just now'
  }
  if (elapsedMs < 3_600_000) {
    const minutes = Math.floor(elapsedMs / 60_000)
    return `${minutes} min ago`
  }
  if (elapsedMs < 86_400_000) {
    const hours = Math.floor(elapsedMs / 3_600_000)
    return `${hours} hr ago`
  }

  const days = Math.floor(elapsedMs / 86_400_000)
  return `${days} d ago`
}

export const formatRelativeDelay = (timestampMs: number, nowMs: number) => {
  const remainingMs = Math.max(0, timestampMs - nowMs)
  if (remainingMs < 60_000) {
    return 'now'
  }
  if (remainingMs < 3_600_000) {
    const minutes = Math.ceil(remainingMs / 60_000)
    return `in ${minutes} min`
  }
  if (remainingMs < 86_400_000) {
    const hours = Math.ceil(remainingMs / 3_600_000)
    return `in ${hours} hr`
  }

  const days = Math.ceil(remainingMs / 86_400_000)
  return `in ${days} d`
}
