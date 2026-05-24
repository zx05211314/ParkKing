import type {
  SyncServiceConfig,
  SyncStatusSnapshot,
} from './syncServiceTypes'
import { DEFAULT_SYNC_MAX_BODY_BYTES } from './syncServiceConfig'

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
  storageFile: string | null
  maxBodyBytes: number | null
  issues: string[]
  snapshot?: SyncStatusSnapshot
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, '')

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
  storageFile: config?.storageFile ?? null,
  maxBodyBytes: config ? config.maxBodyBytes ?? DEFAULT_SYNC_MAX_BODY_BYTES : null,
  issues,
  snapshot,
})
