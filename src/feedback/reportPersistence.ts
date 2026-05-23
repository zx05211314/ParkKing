import {
  fetchJson,
  type ViteEnvLike,
} from '../api/client'
import {
  getSyncRuntimeStatusSnapshot,
  setSyncRuntimeResourceStatus,
} from '../api/syncRuntimeStatus'
import { resolveParkKingSyncServiceConfig } from '../api/syncContract'
import {
  mergeReportLists,
  normalizeReportSegmentId,
  parseRemoteReportsPayload,
  readReportsRevision,
  readStore,
  REPORTS_SCHEMA_VERSION,
  writeStore,
} from './reportStore'
import type { ReportStatus, SegmentReport } from './reportTypes'

const reportsRevisionByEndpoint = new Map<string, number>()

const getSyncFailureReason = (error: unknown) =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message.trim()
    : 'Remote sync is unavailable.'

export interface ReportSyncConfig {
  endpoint: string | null
}

interface LoadReportsOptions {
  config?: ReportSyncConfig
  fetchImpl?: typeof fetch
}

interface AppendReportOptions {
  config?: ReportSyncConfig
  fetchImpl?: typeof fetch
}

interface RetryReportsSyncOptions {
  config?: ReportSyncConfig
  fetchImpl?: typeof fetch
}

export interface RetryReportsSyncResult {
  attemptedCount: number
  syncedCount: number
  remoteSynced: boolean
}

export const resolveReportSyncConfig = (
  env?: ViteEnvLike,
): ReportSyncConfig => ({
  endpoint: resolveParkKingSyncServiceConfig(env).reportsEndpoint,
})

export const getReportsRevision = (endpoint: string | null) =>
  endpoint ? reportsRevisionByEndpoint.get(endpoint) ?? null : null

export const setReportsRevision = (
  endpoint: string | null,
  revision: number | null,
) => {
  if (!endpoint || revision === null) {
    return
  }
  reportsRevisionByEndpoint.set(endpoint, revision)
}

export const writeReports = (reports: SegmentReport[]) => {
  writeStore({
    schemaVersion: REPORTS_SCHEMA_VERSION,
    reports: mergeReportLists(reports, []),
  })
}

interface PostReportToRemoteResult {
  ok: boolean
  failureReason: string | null
}

const postReportToRemote = async (
  report: SegmentReport,
  config: ReportSyncConfig,
  fetchImpl: typeof fetch,
): Promise<PostReportToRemoteResult> => {
  if (!config.endpoint) {
    return {
      ok: false,
      failureReason: 'Reports are stored locally only.',
    }
  }

  try {
    const { response, payload } = await fetchJson(config.endpoint, {
      fetchImpl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ report }),
    })
    if (!response.ok) {
      throw new Error(`Report sync failed with ${response.status}.`)
    }
    setReportsRevision(config.endpoint, readReportsRevision(payload))
    return {
      ok: true,
      failureReason: null,
    }
  } catch (error) {
    return {
      ok: false,
      failureReason: getSyncFailureReason(error),
    }
  }
}

const syncReportToRemote = async (
  report: SegmentReport,
  config: ReportSyncConfig,
  fetchImpl: typeof fetch,
) => {
  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('reports', {
      mode: 'local-only',
      message: 'Reports are stored locally only.',
      pendingCount: 0,
    })
    return false
  }

  const remoteResult = await postReportToRemote(report, config, fetchImpl)
  if (remoteResult.ok) {
    const currentStatus = getSyncRuntimeStatusSnapshot().reports
    setSyncRuntimeResourceStatus('reports', {
      mode: 'remote',
      message: 'Reports are synced with ParkKing Sync.',
      pendingCount: Math.max(0, currentStatus.pendingCount - 1),
      lastRemoteCount:
        currentStatus.lastRemoteCount !== null
          ? currentStatus.lastRemoteCount + 1
          : null,
      remoteEvent: 'push',
    })
    return true
  }

  setSyncRuntimeResourceStatus('reports', {
    mode: 'fallback-local',
    message: 'Reports are using local fallback because remote sync is unavailable.',
    failureReason: remoteResult.failureReason,
  })
  return false
}

export const readReports = (): SegmentReport[] => {
  return readStore().reports
}

export const loadReports = async ({
  config = resolveReportSyncConfig(),
  fetchImpl = fetch,
}: LoadReportsOptions = {}): Promise<SegmentReport[]> => {
  const localStore = readStore()
  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('reports', {
      mode: 'local-only',
      message: 'Reports are stored locally only.',
      pendingCount: 0,
    })
    return localStore.reports
  }

  try {
    const { response, payload } = await fetchJson(config.endpoint, {
      fetchImpl,
    })
    if (!response.ok) {
      throw new Error(`Report request failed with ${response.status}.`)
    }

    const parsedPayload = parseRemoteReportsPayload(payload)
    if (!parsedPayload.valid) {
      throw new Error('Report response did not include a reports array.')
    }

    const mergedReports = mergeReportLists(localStore.reports, parsedPayload.reports)
    setReportsRevision(config.endpoint, readReportsRevision(payload))
    const nextStore = {
      schemaVersion: REPORTS_SCHEMA_VERSION,
      reports: mergedReports,
    }
    writeReports(nextStore.reports)
    const pendingCount = Math.max(
      0,
      nextStore.reports.length - parsedPayload.reports.length,
    )
    setSyncRuntimeResourceStatus('reports', {
      mode: pendingCount > 0 ? 'syncing' : 'remote',
      message:
        pendingCount > 0
          ? 'Reports include local entries waiting for remote confirmation.'
          : 'Reports are synced with ParkKing Sync.',
      pendingCount,
      lastRemoteCount: parsedPayload.reports.length,
      remoteEvent: 'pull',
    })
    return nextStore.reports
  } catch (error) {
    setSyncRuntimeResourceStatus('reports', {
      mode: 'fallback-local',
      message: 'Reports are using local fallback because remote sync is unavailable.',
      failureReason: getSyncFailureReason(error),
    })
    return localStore.reports
  }
}

export const appendReport = (
  entry: {
    districtId: string
    segmentId: string
    status: ReportStatus
    note?: string | null
    createdAt?: string
  },
  options: AppendReportOptions = {},
): SegmentReport => {
  const store = readStore()
  const report: SegmentReport = {
    schemaVersion: REPORTS_SCHEMA_VERSION,
    districtId: entry.districtId,
    segmentId: normalizeReportSegmentId(entry.segmentId),
    status: entry.status,
    note:
      entry.note && entry.note.trim().length > 0 ? entry.note.trim() : null,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }
  const next = {
    schemaVersion: REPORTS_SCHEMA_VERSION,
    reports: mergeReportLists(store.reports, [report]),
  }
  writeReports(next.reports)
  const config = options.config ?? resolveReportSyncConfig()
  const fetchImpl = options.fetchImpl ?? fetch
  if (config.endpoint) {
    const pendingDelta = Math.max(0, next.reports.length - store.reports.length)
    const currentPendingCount = getSyncRuntimeStatusSnapshot().reports.pendingCount
    setSyncRuntimeResourceStatus('reports', {
      mode: 'syncing',
      message: 'Reports are waiting for remote confirmation.',
      pendingCount: currentPendingCount + pendingDelta,
    })
  } else {
    setSyncRuntimeResourceStatus('reports', {
      mode: 'local-only',
      message: 'Reports are stored locally only.',
      pendingCount: 0,
    })
  }
  void syncReportToRemote(report, config, fetchImpl)
  return report
}

export const retryReportsSync = async ({
  config = resolveReportSyncConfig(),
  fetchImpl = fetch,
}: RetryReportsSyncOptions = {}): Promise<RetryReportsSyncResult> => {
  const reports = readReports()
  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('reports', {
      mode: 'local-only',
      message: 'Reports are stored locally only.',
      pendingCount: 0,
    })
    return {
      attemptedCount: reports.length,
      syncedCount: 0,
      remoteSynced: false,
    }
  }

  const startingPendingCount = Math.max(
    getSyncRuntimeStatusSnapshot().reports.pendingCount,
    reports.length,
  )
  setSyncRuntimeResourceStatus('reports', {
    mode: 'syncing',
    message: 'Reports are waiting for remote confirmation.',
    pendingCount: startingPendingCount,
  })

  let syncedCount = 0
  for (const report of reports) {
    const remoteResult = await postReportToRemote(report, config, fetchImpl)
    if (!remoteResult.ok) {
      setSyncRuntimeResourceStatus('reports', {
        mode: 'fallback-local',
        message: 'Reports are using local fallback because remote sync is unavailable.',
        failureReason: remoteResult.failureReason,
        pendingCount: Math.max(0, startingPendingCount - syncedCount),
      })
      return {
        attemptedCount: reports.length,
        syncedCount,
        remoteSynced: false,
      }
    }
    syncedCount += 1
  }

  setSyncRuntimeResourceStatus('reports', {
    mode: 'remote',
    message: 'Reports are synced with ParkKing Sync.',
    pendingCount: 0,
    lastRemoteCount: reports.length,
    remoteEvent: 'push',
  })
  return {
    attemptedCount: reports.length,
    syncedCount,
    remoteSynced: true,
  }
}

export const resetReportsPersistenceStateForTests = () => {
  reportsRevisionByEndpoint.clear()
}
