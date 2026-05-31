import { fetchJson, getApiErrorMessage } from './client'
import { resolveParkKingSyncServiceConfig } from './syncContract'

export interface SyncStatusConfig {
  endpoint: string | null
  readinessEndpoint?: string | null
}

export interface SyncStatusSnapshot {
  scope: string | null
  savedPlansRevision: number
  reportsRevision: number
  issueReportsRevision: number | null
  savedPlansCount: number
  reportsCount: number
  issueReportsCount: number | null
  savedPlansUpdatedAt: string | null
  reportsUpdatedAt: string | null
  issueReportsUpdatedAt: string | null
}

interface LoadSyncStatusOptions {
  config?: SyncStatusConfig
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

interface SyncStatusEnvelope {
  scope?: unknown
  savedPlansRevision?: unknown
  reportsRevision?: unknown
  issueReportsRevision?: unknown
  savedPlansCount?: unknown
  reportsCount?: unknown
  issueReportsCount?: unknown
  savedPlansUpdatedAt?: unknown
  reportsUpdatedAt?: unknown
  issueReportsUpdatedAt?: unknown
}

interface SyncReadinessEnvelope {
  service?: unknown
  status?: unknown
  issues?: unknown
  snapshot?: unknown
}

export const SYNC_SERVICE_UNAVAILABLE_MESSAGE =
  'Sync service is unavailable. Saved plans and reports stay in local fallback until /api/sync or VITE_SYNC_BASE_URL is available.'
export const SYNC_SERVICE_DEGRADED_MESSAGE = 'Sync service is degraded'

const normalizeNonNegativeInteger = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
}

const normalizeTimestamp = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const resolveSyncStatusConfig = (): SyncStatusConfig => {
  const syncConfig = resolveParkKingSyncServiceConfig()
  return {
    endpoint: syncConfig.statusEndpoint,
    readinessEndpoint: syncConfig.readinessEndpoint,
  }
}

export const parseSyncStatusPayload = (
  payload: unknown,
): SyncStatusSnapshot | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const envelope = payload as SyncStatusEnvelope
  const savedPlansRevision = normalizeNonNegativeInteger(
    envelope.savedPlansRevision,
  )
  const reportsRevision = normalizeNonNegativeInteger(envelope.reportsRevision)
  const issueReportsRevision = normalizeNonNegativeInteger(
    envelope.issueReportsRevision,
  )
  const savedPlansCount = normalizeNonNegativeInteger(envelope.savedPlansCount)
  const reportsCount = normalizeNonNegativeInteger(envelope.reportsCount)
  const issueReportsCount = normalizeNonNegativeInteger(envelope.issueReportsCount)
  if (
    savedPlansRevision === null ||
    reportsRevision === null ||
    savedPlansCount === null ||
    reportsCount === null
  ) {
    return null
  }

  return {
    scope: normalizeTimestamp(envelope.scope),
    savedPlansRevision,
    reportsRevision,
    issueReportsRevision,
    savedPlansCount,
    reportsCount,
    issueReportsCount,
    savedPlansUpdatedAt: normalizeTimestamp(envelope.savedPlansUpdatedAt),
    reportsUpdatedAt: normalizeTimestamp(envelope.reportsUpdatedAt),
    issueReportsUpdatedAt: normalizeTimestamp(envelope.issueReportsUpdatedAt),
  }
}

const normalizeIssues = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const buildSyncReadinessMessage = (issues: string[]) =>
  issues.length > 0
    ? `${SYNC_SERVICE_DEGRADED_MESSAGE}: ${issues.join('; ')}`
    : SYNC_SERVICE_DEGRADED_MESSAGE

export const parseSyncReadinessPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return {
      ok: false as const,
      issues: [],
      snapshot: null,
    }
  }

  const envelope = payload as SyncReadinessEnvelope
  const issues = normalizeIssues(envelope.issues)
  if (envelope.service !== 'sync-service') {
    return {
      ok: false as const,
      issues,
      snapshot: null,
    }
  }

  return {
    ok: envelope.status === 'ok',
    issues,
    snapshot: parseSyncStatusPayload(envelope.snapshot),
  }
}

export const loadSyncStatus = async ({
  config = resolveSyncStatusConfig(),
  fetchImpl = fetch,
  signal,
}: LoadSyncStatusOptions = {}): Promise<SyncStatusSnapshot | null> => {
  if (!config.endpoint) {
    return null
  }

  if (config.readinessEndpoint) {
    const { response, payload } = await fetchJson(config.readinessEndpoint, {
      fetchImpl,
      signal,
    })
    if (response.status === 404) {
      throw new Error(SYNC_SERVICE_UNAVAILABLE_MESSAGE)
    }

    const readiness = parseSyncReadinessPayload(payload)
    if (!response.ok || !readiness.ok) {
      throw new Error(
        getApiErrorMessage(payload, buildSyncReadinessMessage(readiness.issues)),
      )
    }
    if (readiness.snapshot) {
      return readiness.snapshot
    }
  }

  const { response, payload } = await fetchJson(config.endpoint, {
    fetchImpl,
    signal,
  })
  if (!response.ok) {
    throw new Error(`Sync status request failed with ${response.status}.`)
  }

  const snapshot = parseSyncStatusPayload(payload)
  if (!snapshot) {
    throw new Error('Sync status response was malformed.')
  }
  return snapshot
}
