import type {
  SyncServiceConfig,
  SyncServiceDurability,
  SyncServiceMode,
  SyncStatusSnapshot,
} from './syncServiceTypes'
import {
  DEFAULT_SYNC_CORS_ORIGINS,
  DEFAULT_SYNC_DURABILITY,
  DEFAULT_SYNC_ISSUE_SINK_TIMEOUT_MS,
  DEFAULT_SYNC_MAX_BODY_BYTES,
  DEFAULT_SYNC_MAX_ISSUE_REPORTS,
  DEFAULT_SYNC_MODE,
  DEFAULT_SYNC_WRITE_RATE_LIMIT_MAX,
  DEFAULT_SYNC_WRITE_RATE_LIMIT_WINDOW_MS,
} from './syncServiceConfig'
import { validateSyncIssueSinkConfig } from './syncServiceIssueSink'

export interface SyncServiceHealthResponse {
  schemaVersion: 1
  service: 'sync-service'
  status: 'ok' | 'degraded'
  basePath: string
  healthPath: string
  readinessPath: string
  statusPath: string
  bootstrapPath: string
  savedPlansPath: string
  reportsPath: string
  issuesPath: string
  defaultScope: string
  mode: SyncServiceMode
  durability: SyncServiceDurability
  capabilities: {
    savedPlansRead: boolean
    savedPlansWrite: boolean
    reportsRead: boolean
    reportsWrite: boolean
    issueReportsRead: boolean
    issueReportsWrite: boolean
  }
  storageFile: string | null
  maxBodyBytes: number | null
  maxIssueReports: number | null
  corsOrigins: string[] | null
  writeRateLimitWindowMs: number | null
  writeRateLimitMax: number | null
  issueSink: {
    configured: boolean
    timeoutMs: number | null
  }
  issues: string[]
  snapshot?: SyncStatusSnapshot
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, '')

const buildSyncServiceCapabilities = (mode: SyncServiceMode) => {
  const full = mode === 'full'
  return {
    savedPlansRead: full,
    savedPlansWrite: full,
    reportsRead: full,
    reportsWrite: full,
    issueReportsRead: full,
    issueReportsWrite: true,
  }
}

export const joinSyncServicePath = (basePath: string, suffix: string) =>
  `${trimTrailingSlash(basePath)}/${suffix.replace(/^\/+/g, '')}`

export const buildSyncServiceReadinessIssues = (
  config: SyncServiceConfig | null,
) => {
  if (!config) {
    return ['sync service config unavailable']
  }

  const issues: string[] = []
  if (!config.storageFile.trim()) {
    issues.push('storage file is empty')
  }
  if (!config.defaultScope.trim()) {
    issues.push('default scope is empty')
  }
  if (
    config.maxBodyBytes !== undefined &&
    (!Number.isFinite(config.maxBodyBytes) || config.maxBodyBytes <= 0)
  ) {
    issues.push('max body bytes must be positive')
  }
  if (
    config.maxIssueReports !== undefined &&
    (!Number.isFinite(config.maxIssueReports) || config.maxIssueReports <= 0)
  ) {
    issues.push('max issue reports must be positive')
  }
  if (
    config.corsOrigins !== undefined &&
    (!Array.isArray(config.corsOrigins) || config.corsOrigins.length === 0)
  ) {
    issues.push('cors origins must not be empty')
  }
  if (
    config.writeRateLimitWindowMs !== undefined &&
    (!Number.isFinite(config.writeRateLimitWindowMs) ||
      config.writeRateLimitWindowMs <= 0)
  ) {
    issues.push('write rate limit window must be positive')
  }
  if (
    config.writeRateLimitMax !== undefined &&
    (!Number.isFinite(config.writeRateLimitMax) || config.writeRateLimitMax <= 0)
  ) {
    issues.push('write rate limit max must be positive')
  }
  if (
    config.issueSinkTimeoutMs !== undefined &&
    (!Number.isFinite(config.issueSinkTimeoutMs) ||
      config.issueSinkTimeoutMs <= 0)
  ) {
    issues.push('issue sink timeout must be positive')
  }
  const issueSinkError = validateSyncIssueSinkConfig(config)
  if (issueSinkError) {
    issues.push(issueSinkError)
  }
  return issues
}

export const buildSyncServiceHealth = (
  pathname: string,
  defaultScope: string,
  config: SyncServiceConfig | null = null,
  issues: string[] = [],
  snapshot?: SyncStatusSnapshot,
): SyncServiceHealthResponse => ({
  schemaVersion: 1,
  service: 'sync-service',
  status: issues.length === 0 ? 'ok' : 'degraded',
  basePath: trimTrailingSlash(pathname),
  healthPath: joinSyncServicePath(pathname, 'health'),
  readinessPath: joinSyncServicePath(pathname, 'ready'),
  statusPath: joinSyncServicePath(pathname, 'status'),
  bootstrapPath: joinSyncServicePath(pathname, 'bootstrap'),
  savedPlansPath: joinSyncServicePath(pathname, 'saved-plans'),
  reportsPath: joinSyncServicePath(pathname, 'reports'),
  issuesPath: joinSyncServicePath(pathname, 'issues'),
  defaultScope,
  mode: config?.mode ?? DEFAULT_SYNC_MODE,
  durability: config?.durability ?? DEFAULT_SYNC_DURABILITY,
  capabilities: buildSyncServiceCapabilities(
    config?.mode ?? DEFAULT_SYNC_MODE,
  ),
  storageFile: config?.storageFile ?? null,
  maxBodyBytes: config ? config.maxBodyBytes ?? DEFAULT_SYNC_MAX_BODY_BYTES : null,
  maxIssueReports: config
    ? config.maxIssueReports ?? DEFAULT_SYNC_MAX_ISSUE_REPORTS
    : null,
  corsOrigins: config ? config.corsOrigins ?? DEFAULT_SYNC_CORS_ORIGINS : null,
  writeRateLimitWindowMs: config
    ? config.writeRateLimitWindowMs ?? DEFAULT_SYNC_WRITE_RATE_LIMIT_WINDOW_MS
    : null,
  writeRateLimitMax: config
    ? config.writeRateLimitMax ?? DEFAULT_SYNC_WRITE_RATE_LIMIT_MAX
    : null,
  issueSink: {
    configured: Boolean(config?.issueSinkUrl?.trim()),
    timeoutMs: config
      ? config.issueSinkTimeoutMs ?? DEFAULT_SYNC_ISSUE_SINK_TIMEOUT_MS
      : null,
  },
  issues,
  snapshot,
})
