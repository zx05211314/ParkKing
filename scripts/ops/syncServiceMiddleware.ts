import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  DEFAULT_SYNC_PATH,
  DEFAULT_SYNC_SCOPE,
  normalizeScope,
} from './syncServiceConfig'
import {
  setSyncServiceCorsHeaders,
  writeSyncServiceJson,
} from './syncServiceHttp'
import {
  handleSyncBootstrapRequest,
  handleSyncIssueReportsRequest,
  handleSyncReportsRequest,
  handleSyncSavedPlansRequest,
  handleSyncStatusRequest,
} from './syncServiceRequestHandlers'
import {
  buildSyncServiceHealth,
  buildSyncServiceReadinessIssues,
} from './syncServiceHealth'
import type { SyncService, SyncServiceConfig } from './syncServiceTypes'

export const createSyncServiceMiddleware = (
  service: SyncService,
  pathname = DEFAULT_SYNC_PATH,
  defaultScope = DEFAULT_SYNC_SCOPE,
  config: SyncServiceConfig | null = null,
) => {
  const basePath = pathname.replace(/\/+$/, '')
  const healthPath = `${basePath}/health`
  const readinessPath = `${basePath}/ready`
  const bootstrapPath = `${basePath}/bootstrap`
  const statusPath = `${basePath}/status`
  const savedPlansPath = `${basePath}/saved-plans`
  const reportsPath = `${basePath}/reports`
  const issuesPath = `${basePath}/issues`

  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const scope = normalizeScope(url.searchParams.get('scope'), defaultScope)
    if (
      url.pathname !== healthPath &&
      url.pathname !== readinessPath &&
      url.pathname !== bootstrapPath &&
      url.pathname !== statusPath &&
      url.pathname !== savedPlansPath &&
      url.pathname !== reportsPath &&
      url.pathname !== issuesPath
    ) {
      next?.()
      return false
    }

    setSyncServiceCorsHeaders(res)
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return true
    }

    try {
      if (url.pathname === healthPath) {
        if (req.method !== 'GET') {
          writeSyncServiceJson(res, 405, { error: 'Method not allowed.' })
          return true
        }
        writeSyncServiceJson(
          res,
          200,
          buildSyncServiceHealth(pathname, defaultScope, config),
        )
        return true
      }

      if (url.pathname === readinessPath) {
        if (req.method !== 'GET') {
          writeSyncServiceJson(res, 405, { error: 'Method not allowed.' })
          return true
        }
        const issues = buildSyncServiceReadinessIssues(config)
        let snapshot
        if (issues.length === 0) {
          snapshot = await service.getSyncStatus(scope)
        }
        writeSyncServiceJson(
          res,
          issues.length === 0 ? 200 : 503,
          buildSyncServiceHealth(pathname, defaultScope, config, issues, snapshot),
        )
        return true
      }

      if (url.pathname === bootstrapPath) {
        return handleSyncBootstrapRequest({ req, res, service, scope, url })
      }

      if (url.pathname === statusPath) {
        return handleSyncStatusRequest({ req, res, service, scope, url })
      }

      if (url.pathname === savedPlansPath) {
        return handleSyncSavedPlansRequest({ req, res, service, scope, url })
      }

      if (url.pathname === reportsPath) {
        return handleSyncReportsRequest({ req, res, service, scope, url })
      }

      if (url.pathname === issuesPath) {
        return handleSyncIssueReportsRequest({ req, res, service, scope, url })
      }

      return handleSyncReportsRequest({ req, res, service, scope, url })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sync service request failed.'
      writeSyncServiceJson(res, 400, { error: message })
      return true
    }
  }
}
