import {
  fetchJson,
  normalizeOptionalText,
  readViteEnv,
  type ViteEnvLike,
} from '../api/client'
import {
  getSyncRuntimeStatusSnapshot,
  setSyncRuntimeResourceStatus,
} from '../api/syncRuntimeStatus'
import { resolveParkKingSyncServiceConfig } from '../api/syncContract'
import {
  ISSUE_REPORTS_SCHEMA_VERSION,
  type IssueReport,
} from './issueReportTypes'
import {
  mergeIssueReportLists,
  readIssueReportStore,
  writeIssueReportStore,
} from './issueReportStore'

export interface IssueReportSyncConfig {
  endpoint: string | null
}

export interface AppendIssueReportResult {
  issue: IssueReport
  remoteSynced: boolean
  mode: 'remote' | 'local-only' | 'fallback-local'
  message: string
  failureReason: string | null
}

interface AppendIssueReportOptions {
  config?: IssueReportSyncConfig
  fetchImpl?: typeof fetch
}

interface RetryIssueReportsSyncOptions {
  config?: IssueReportSyncConfig
  fetchImpl?: typeof fetch
}

export interface RetryIssueReportsSyncResult {
  attemptedCount: number
  syncedCount: number
  remoteSynced: boolean
}

const getIssueSyncFailureReason = (error: unknown) =>
  error instanceof Error && error.message.trim().length > 0
    ? error.message.trim()
    : 'Issue submission is unavailable.'

const createIssueId = () =>
  `issue-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

export const resolveIssueReportSyncConfig = (
  env: ViteEnvLike = readViteEnv(),
): IssueReportSyncConfig => {
  return {
    endpoint: resolveParkKingSyncServiceConfig(env).issueReportsEndpoint,
  }
}

export const readIssueReports = (): IssueReport[] => readIssueReportStore().issues

interface PostIssueReportToRemoteResult {
  ok: boolean
  failureReason: string | null
}

const postIssueReportToRemote = async (
  issue: IssueReport,
  config: IssueReportSyncConfig,
  fetchImpl: typeof fetch,
): Promise<PostIssueReportToRemoteResult> => {
  if (!config.endpoint) {
    return {
      ok: false,
      failureReason: 'Issue reports are stored locally only.',
    }
  }

  try {
    const { response, payload } = await fetchJson(config.endpoint, {
      fetchImpl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ issue }),
    })
    if (!response.ok) {
      const fallback =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : `Issue sync failed with ${response.status}.`
      throw new Error(fallback)
    }
    return {
      ok: true,
      failureReason: null,
    }
  } catch (error) {
    return {
      ok: false,
      failureReason: getIssueSyncFailureReason(error),
    }
  }
}

export const appendIssueReport = async (
  entry: {
    districtId?: string | null
    segmentId?: string | null
    summary: string
    bundle: unknown
    createdAt?: string
    issueId?: string
  },
  {
    config = resolveIssueReportSyncConfig(),
    fetchImpl = fetch,
  }: AppendIssueReportOptions = {},
): Promise<AppendIssueReportResult> => {
  const issue: IssueReport = {
    schemaVersion: ISSUE_REPORTS_SCHEMA_VERSION,
    issueId: normalizeOptionalText(entry.issueId) ?? createIssueId(),
    districtId: normalizeOptionalText(entry.districtId),
    segmentId: normalizeOptionalText(entry.segmentId),
    summary: normalizeOptionalText(entry.summary) ?? 'Issue report',
    createdAt: entry.createdAt ?? new Date().toISOString(),
    bundle: entry.bundle,
  }

  const store = readIssueReportStore()
  const nextIssues = mergeIssueReportLists(store.issues, [issue])
  writeIssueReportStore({
    schemaVersion: ISSUE_REPORTS_SCHEMA_VERSION,
    issues: nextIssues,
  })
  const localIssueCount = nextIssues.length

  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('issueReports', {
      mode: 'local-only',
      message: 'Issue reports are stored locally only.',
      pendingCount: 0,
      lastRemoteCount: localIssueCount,
    })
    return {
      issue,
      remoteSynced: false,
      mode: 'local-only',
      message: 'Issue saved locally only.',
      failureReason: null,
    }
  }

  const remoteResult = await postIssueReportToRemote(issue, config, fetchImpl)
  if (remoteResult.ok) {
    setSyncRuntimeResourceStatus('issueReports', {
      mode: 'remote',
      message: 'Issue reports are synced.',
      pendingCount: 0,
      lastRemoteCount: localIssueCount,
      remoteEvent: 'push',
    })

    return {
      issue,
      remoteSynced: true,
      mode: 'remote',
      message: 'Issue submitted to ParkKing Sync.',
      failureReason: null,
    }
  }

  const failureReason = remoteResult.failureReason
  setSyncRuntimeResourceStatus('issueReports', {
    mode: 'fallback-local',
    message: 'Issue reports are using local fallback.',
    pendingCount: localIssueCount,
    failureReason,
    lastRemoteCount: localIssueCount,
  })
  return {
    issue,
    remoteSynced: false,
    mode: 'fallback-local',
    message: 'Issue saved locally because remote submission is unavailable.',
    failureReason,
  }
}

export const retryIssueReportsSync = async ({
  config = resolveIssueReportSyncConfig(),
  fetchImpl = fetch,
}: RetryIssueReportsSyncOptions = {}): Promise<RetryIssueReportsSyncResult> => {
  const issues = readIssueReports()
  if (!config.endpoint) {
    setSyncRuntimeResourceStatus('issueReports', {
      mode: 'local-only',
      message: 'Issue reports are stored locally only.',
      pendingCount: 0,
    })
    return {
      attemptedCount: issues.length,
      syncedCount: 0,
      remoteSynced: false,
    }
  }

  const startingPendingCount = Math.max(
    getSyncRuntimeStatusSnapshot().issueReports.pendingCount,
    issues.length,
  )
  setSyncRuntimeResourceStatus('issueReports', {
    mode: 'syncing',
    message: 'Issue reports are waiting for remote confirmation.',
    pendingCount: startingPendingCount,
  })

  let syncedCount = 0
  for (const issue of issues) {
    const remoteResult = await postIssueReportToRemote(issue, config, fetchImpl)
    if (!remoteResult.ok) {
      setSyncRuntimeResourceStatus('issueReports', {
        mode: 'fallback-local',
        message: 'Issue reports are using local fallback.',
        failureReason: remoteResult.failureReason,
        pendingCount: Math.max(0, startingPendingCount - syncedCount),
      })
      return {
        attemptedCount: issues.length,
        syncedCount,
        remoteSynced: false,
      }
    }
    syncedCount += 1
  }

  setSyncRuntimeResourceStatus('issueReports', {
    mode: 'remote',
    message: 'Issue reports are synced.',
    pendingCount: 0,
    lastRemoteCount: issues.length,
    remoteEvent: 'push',
  })
  return {
    attemptedCount: issues.length,
    syncedCount,
    remoteSynced: true,
  }
}
