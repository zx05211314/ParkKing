import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  DEFAULT_SYNC_CORS_ORIGINS,
  DEFAULT_SYNC_MODE,
  DEFAULT_SYNC_PATH,
  DEFAULT_SYNC_SCOPE,
  DEFAULT_SYNC_MAX_BODY_BYTES,
  DEFAULT_SYNC_WRITE_RATE_LIMIT_MAX,
  DEFAULT_SYNC_WRITE_RATE_LIMIT_WINDOW_MS,
  normalizeScope,
  normalizeSyncText,
} from './syncServiceConfig'
import {
  isSyncServiceCorsOriginAllowed,
  setSyncServiceCorsHeaders,
  SyncServicePayloadTooLargeError,
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
import { createSyncServiceWriteRateLimiter } from './syncServiceRateLimit'
import type { SyncService, SyncServiceConfig } from './syncServiceTypes'

const resolveHeaderText = (value: string | string[] | undefined) =>
  Array.isArray(value) ? normalizeSyncText(value[0]) : normalizeSyncText(value)

const resolveWriteRateLimitClientId = (req: IncomingMessage) =>
  resolveHeaderText(req.headers?.['x-forwarded-for'])?.split(',')[0]?.trim() ||
  resolveHeaderText(req.headers?.['x-real-ip']) ||
  req.socket?.remoteAddress ||
  'unknown-client'

const isSyncServiceWriteRequest = (
  pathname: string,
  method: string | undefined,
  paths: {
    savedPlansPath: string
    reportsPath: string
    issuesPath: string
  },
) =>
  (pathname === paths.savedPlansPath && method === 'PUT') ||
  (pathname === paths.reportsPath && method === 'POST') ||
  (pathname === paths.issuesPath && method === 'POST')

const isSyncServiceModeRequestAllowed = (
  mode: SyncServiceConfig['mode'],
  pathname: string,
  method: string | undefined,
  requestedMethod: string | null,
  paths: {
    healthPath: string
    readinessPath: string
    statusPath: string
    issuesPath: string
  },
) => {
  if ((mode ?? DEFAULT_SYNC_MODE) === 'full') {
    return true
  }
  if (
    pathname === paths.healthPath ||
    pathname === paths.readinessPath ||
    pathname === paths.statusPath
  ) {
    return true
  }
  if (pathname !== paths.issuesPath) {
    return false
  }
  return (
    method === 'POST' ||
    (method === 'OPTIONS' && requestedMethod?.toUpperCase() === 'POST')
  )
}

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
  const maxBodyBytes = config?.maxBodyBytes ?? DEFAULT_SYNC_MAX_BODY_BYTES
  const corsOrigins = config?.corsOrigins ?? DEFAULT_SYNC_CORS_ORIGINS
  const writeRateLimitWindowMs =
    config?.writeRateLimitWindowMs ?? DEFAULT_SYNC_WRITE_RATE_LIMIT_WINDOW_MS
  const writeRateLimitMax =
    config?.writeRateLimitMax ?? DEFAULT_SYNC_WRITE_RATE_LIMIT_MAX
  const writeRateLimiter = createSyncServiceWriteRateLimiter({
    windowMs: writeRateLimitWindowMs,
    maxRequests: writeRateLimitMax,
  })

  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const scope = normalizeScope(url.searchParams.get('scope'), defaultScope)
    const originHeader = req.headers?.origin
    const requestOrigin = Array.isArray(originHeader)
      ? normalizeSyncText(originHeader[0])
      : normalizeSyncText(originHeader)
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

    setSyncServiceCorsHeaders(res, {
      requestOrigin,
      allowedOrigins: corsOrigins,
    })
    if (
      !isSyncServiceCorsOriginAllowed({
        requestOrigin,
        allowedOrigins: corsOrigins,
      })
    ) {
      writeSyncServiceJson(res, 403, {
        error: 'Origin is not allowed by sync service CORS policy.',
      })
      return true
    }

    const requestedMethod = resolveHeaderText(
      req.headers?.['access-control-request-method'],
    )
    if (
      !isSyncServiceModeRequestAllowed(
        config?.mode,
        url.pathname,
        req.method,
        requestedMethod,
        {
          healthPath,
          readinessPath,
          statusPath,
          issuesPath,
        },
      )
    ) {
      writeSyncServiceJson(res, 403, {
        error: 'Sync resource is disabled in issue-upload-only mode.',
      })
      return true
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return true
    }

    if (
      isSyncServiceWriteRequest(url.pathname, req.method, {
        savedPlansPath,
        reportsPath,
        issuesPath,
      })
    ) {
      const rateLimit = writeRateLimiter.check({
        clientId: resolveWriteRateLimitClientId(req),
        route: url.pathname,
        scope,
      })
      res.setHeader('X-RateLimit-Limit', String(writeRateLimitMax))
      res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining))
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAtMs / 1000)))
      if (!rateLimit.allowed) {
        res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds))
        writeSyncServiceJson(res, 429, {
          error: 'Sync service write rate limit exceeded.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        })
        return true
      }
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
        return await handleSyncBootstrapRequest({
          req,
          res,
          service,
          scope,
          url,
          maxBodyBytes,
        })
      }

      if (url.pathname === statusPath) {
        return await handleSyncStatusRequest({
          req,
          res,
          service,
          scope,
          url,
          maxBodyBytes,
        })
      }

      if (url.pathname === savedPlansPath) {
        return await handleSyncSavedPlansRequest({
          req,
          res,
          service,
          scope,
          url,
          maxBodyBytes,
        })
      }

      if (url.pathname === reportsPath) {
        return await handleSyncReportsRequest({
          req,
          res,
          service,
          scope,
          url,
          maxBodyBytes,
        })
      }

      if (url.pathname === issuesPath) {
        return await handleSyncIssueReportsRequest({
          req,
          res,
          service,
          scope,
          url,
          maxBodyBytes,
        })
      }

      return await handleSyncReportsRequest({
        req,
        res,
        service,
        scope,
        url,
        maxBodyBytes,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sync service request failed.'
      writeSyncServiceJson(
        res,
        error instanceof SyncServicePayloadTooLargeError ? 413 : 400,
        { error: message },
      )
      return true
    }
  }
}
