import * as fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'
import {
  createGeocodeProxyMiddleware,
  createGeocodeProxyService,
  resolveGeocodeProxyConfig,
} from './geocodeProxy'
import {
  createParkingAnswerService,
  createParkingAnswerServiceMiddleware,
  resolveParkingAnswerServiceConfig,
} from './parkingAnswerService'
import {
  createRoutingProxyMiddleware,
  createRoutingProxyService,
  resolveRoutingProxyConfig,
} from './routingProxy'
import {
  createSyncService,
  createSyncServiceMiddleware,
  resolveSyncServiceConfig,
} from './syncService'

const DEFAULT_APP_PORT = 4173
const DEFAULT_STATIC_DIR = 'dist'
const DEFAULT_HEALTH_PATH = '/api/app/health'
const DEFAULT_READY_PATH = '/api/app/ready'

export type ParkKingAppMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void,
) => boolean | Promise<boolean> | void | Promise<void>

export interface ParkKingAppServerConfig {
  port: number
  host: string | null
  staticDir: string
  spaFallback: boolean
  healthPath: string
  readyPath: string
  api: {
    geocoder: boolean
    routing: boolean
    parkingAnswer: boolean
    sync: boolean
  }
}

export interface ParkKingAppServerOptions {
  config?: ParkKingAppServerConfig
  middlewares?: ParkKingAppMiddleware[]
}

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
}

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const parseEnabled = (value: string | undefined, fallback: boolean) => {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized) {
    return fallback
  }
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false
  }
  return fallback
}

const normalizeRoutePath = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export const resolveParkKingAppServerConfig = (
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): ParkKingAppServerConfig => {
  const appPort = normalizeText(env.PARKKING_APP_PORT) ?? normalizeText(env.PORT)

  return {
    port: parsePositiveInteger(appPort ?? undefined, DEFAULT_APP_PORT),
    host: normalizeText(env.PARKKING_APP_HOST),
    staticDir: path.resolve(cwd, env.PARKKING_APP_STATIC_DIR ?? DEFAULT_STATIC_DIR),
    spaFallback: parseEnabled(env.PARKKING_APP_SPA_FALLBACK, true),
    healthPath: normalizeRoutePath(
      normalizeText(env.PARKKING_APP_HEALTH_PATH),
      DEFAULT_HEALTH_PATH,
    ),
    readyPath: normalizeRoutePath(
      normalizeText(env.PARKKING_APP_READY_PATH),
      DEFAULT_READY_PATH,
    ),
    api: {
      geocoder: parseEnabled(env.PARKKING_APP_ENABLE_GEOCODER, true),
      routing: parseEnabled(env.PARKKING_APP_ENABLE_ROUTING, true),
      parkingAnswer: parseEnabled(env.PARKKING_APP_ENABLE_PARKING_ANSWER, true),
      sync: parseEnabled(env.PARKKING_APP_ENABLE_SYNC, true),
    },
  }
}

export const createParkKingAppMiddlewares = (
  config: ParkKingAppServerConfig,
): ParkKingAppMiddleware[] => {
  const middlewares: ParkKingAppMiddleware[] = []

  if (config.api.geocoder) {
    const geocodeConfig = resolveGeocodeProxyConfig()
    middlewares.push(
      createGeocodeProxyMiddleware(
        createGeocodeProxyService(geocodeConfig),
        geocodeConfig.path,
        geocodeConfig,
      ),
    )
  }

  if (config.api.routing) {
    const routingConfig = resolveRoutingProxyConfig()
    middlewares.push(
      createRoutingProxyMiddleware(
        createRoutingProxyService(routingConfig),
        routingConfig.path,
        routingConfig,
      ),
    )
  }

  if (config.api.parkingAnswer) {
    const parkingConfig = resolveParkingAnswerServiceConfig()
    middlewares.push(
      createParkingAnswerServiceMiddleware(
        createParkingAnswerService(),
        parkingConfig,
        parkingConfig.path,
      ),
    )
  }

  if (config.api.sync) {
    const syncConfig = resolveSyncServiceConfig()
    middlewares.push(
      createSyncServiceMiddleware(
        createSyncService(syncConfig),
        syncConfig.path,
        syncConfig.defaultScope,
        syncConfig,
      ),
    )
  }

  return middlewares
}

const writeJson = (res: ServerResponse, statusCode: number, body: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

const isApiPath = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/')

const decodePathname = (pathname: string) => {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return null
  }
}

const resolveSafeStaticPath = (staticDir: string, pathname: string) => {
  const decoded = decodePathname(pathname)
  if (decoded === null) {
    return null
  }

  const relative = decoded.replace(/^\/+/, '') || 'index.html'
  const normalized = path.normalize(relative)
  if (
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`) ||
    path.isAbsolute(normalized)
  ) {
    return null
  }

  return path.join(staticDir, normalized)
}

const findStaticFile = async (
  staticDir: string,
  pathname: string,
  spaFallback: boolean,
) => {
  const requestedPath = resolveSafeStaticPath(staticDir, pathname)
  if (!requestedPath) {
    return null
  }

  const requestedStat = await fs.stat(requestedPath).catch(() => null)
  if (requestedStat?.isFile()) {
    return requestedPath
  }
  if (requestedStat?.isDirectory()) {
    const indexPath = path.join(requestedPath, 'index.html')
    const indexStat = await fs.stat(indexPath).catch(() => null)
    if (indexStat?.isFile()) {
      return indexPath
    }
  }

  if (!spaFallback) {
    return null
  }

  const fallbackPath = path.join(staticDir, 'index.html')
  const fallbackStat = await fs.stat(fallbackPath).catch(() => null)
  return fallbackStat?.isFile() ? fallbackPath : null
}

const cacheControlForFile = (staticDir: string, filePath: string) => {
  const relative = path.relative(staticDir, filePath).replace(/\\/g, '/')
  if (relative === 'index.html' || relative.endsWith('/index.html')) {
    return 'no-cache'
  }
  if (relative.startsWith('assets/')) {
    return 'public, max-age=31536000, immutable'
  }
  return 'public, max-age=300'
}

export const acceptsGzipEncoding = (value: string | string[] | undefined) => {
  const entries = (Array.isArray(value) ? value.join(',') : value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  let gzipQuality: number | null = null
  let wildcardQuality: number | null = null
  for (const entry of entries) {
    const [encoding, ...parameters] = entry.split(';').map((part) => part.trim())
    if (encoding !== 'gzip' && encoding !== '*') {
      continue
    }
    const qualityParameter = parameters.find((parameter) => parameter.startsWith('q='))
    const parsedQuality = qualityParameter
      ? Number.parseFloat(qualityParameter.slice(2))
      : 1
    const quality = Number.isFinite(parsedQuality) ? parsedQuality : 0
    if (encoding === 'gzip') {
      gzipQuality = quality
    } else {
      wildcardQuality = quality
    }
  }

  return (gzipQuality ?? wildcardQuality ?? 0) > 0
}

const resolveStaticRepresentation = async (
  req: IncomingMessage,
  filePath: string,
) => {
  if (acceptsGzipEncoding(req.headers['accept-encoding'])) {
    const gzipPath = `${filePath}.gz`
    const gzipStat = await fs.stat(gzipPath).catch(() => null)
    if (gzipStat?.isFile()) {
      return {
        filePath: gzipPath,
        contentLength: gzipStat.size,
        contentEncoding: 'gzip' as const,
      }
    }
  }

  const fileStat = await fs.stat(filePath)
  return {
    filePath,
    contentLength: fileStat.size,
    contentEncoding: null,
  }
}

const serveStaticFile = async (
  req: IncomingMessage,
  res: ServerResponse,
  config: ParkKingAppServerConfig,
) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeJson(res, 405, { error: 'Method not allowed.' })
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const filePath = await findStaticFile(
    config.staticDir,
    url.pathname,
    config.spaFallback,
  )
  if (!filePath) {
    writeJson(res, 404, { error: 'Not found.' })
    return
  }

  const representation = await resolveStaticRepresentation(req, filePath)
  res.statusCode = 200
  res.setHeader(
    'Content-Type',
    MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
  )
  res.setHeader('Cache-Control', cacheControlForFile(config.staticDir, filePath))
  res.setHeader('Vary', 'Accept-Encoding')
  res.setHeader('Content-Length', String(representation.contentLength))
  if (representation.contentEncoding) {
    res.setHeader('Content-Encoding', representation.contentEncoding)
  }
  if (req.method === 'HEAD') {
    res.end()
    return
  }

  try {
    await pipeline(createReadStream(representation.filePath), res)
  } catch (error) {
    if (!res.headersSent) {
      writeJson(res, 500, { error: 'Failed to read static file.' })
    } else {
      res.destroy(error instanceof Error ? error : undefined)
    }
  }
}

const staticReadinessIssues = async (config: ParkKingAppServerConfig) => {
  const issues: string[] = []
  const indexPath = path.join(config.staticDir, 'index.html')
  const indexStat = await fs.stat(indexPath).catch(() => null)
  if (!indexStat?.isFile()) {
    issues.push(`static index missing at ${indexPath}`)
  }
  return issues
}

const maybeHandleAppStatus = async (
  req: IncomingMessage,
  res: ServerResponse,
  config: ParkKingAppServerConfig,
) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const isHealth = url.pathname === config.healthPath
  const isReady = url.pathname === config.readyPath
  if (!isHealth && !isReady) {
    return false
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeJson(res, 405, { error: 'Method not allowed.' })
    return true
  }

  const issues = isReady ? await staticReadinessIssues(config) : []
  const body = {
    service: 'parkking-app',
    status: issues.length === 0 ? 'ok' : 'degraded',
    staticDir: config.staticDir,
    spaFallback: config.spaFallback,
    api: config.api,
    issues,
  }

  writeJson(res, issues.length === 0 ? 200 : 503, body)
  return true
}

const runMiddlewares = async (
  req: IncomingMessage,
  res: ServerResponse,
  middlewares: ParkKingAppMiddleware[],
) => {
  for (const middleware of middlewares) {
    let nextCalled = false
    const handled = await middleware(req, res, () => {
      nextCalled = true
    })
    if (res.writableEnded || handled === true) {
      return true
    }
    if (!nextCalled && handled !== false) {
      return res.writableEnded
    }
  }
  return false
}

export const createParkKingAppRequestHandler = (
  options: ParkKingAppServerOptions = {},
) => {
  const config = options.config ?? resolveParkKingAppServerConfig()
  const middlewares = options.middlewares ?? createParkKingAppMiddlewares(config)

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (await maybeHandleAppStatus(req, res, config)) {
      return
    }

    if (await runMiddlewares(req, res, middlewares)) {
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    if (isApiPath(url.pathname)) {
      writeJson(res, 404, { error: 'API route not found.' })
      return
    }

    await serveStaticFile(req, res, config)
  }
}

export const startParkKingAppServer = (
  options: ParkKingAppServerOptions = {},
) => {
  const config = options.config ?? resolveParkKingAppServerConfig()
  const server = createServer(createParkKingAppRequestHandler({
    ...options,
    config,
  }))
  if (config.host) {
    server.listen(config.port, config.host)
  } else {
    server.listen(config.port)
  }
  return server
}

export const runParkKingAppServer = (
  config: ParkKingAppServerConfig = resolveParkKingAppServerConfig(),
) => {
  const server = startParkKingAppServer({ config })
  server.on('listening', () => {
    const host = config.host ?? '0.0.0.0'
    console.log(
      `ParkKing app server listening on http://${host}:${config.port} (static ${config.staticDir})`,
    )
  })
  return server
}

const isMainModule = () => {
  const entry = process.argv[1]
  return entry ? pathToFileURL(entry).href === import.meta.url : false
}

if (isMainModule()) {
  runParkKingAppServer()
}
