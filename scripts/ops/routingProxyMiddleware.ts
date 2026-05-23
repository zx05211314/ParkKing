import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_PROXY_PATH } from './routingProxyConfig'
import {
  handleRoutingMatrixRequest,
  handleRoutingPathRequest,
} from './routingProxyRequestHandlers'
import {
  parseRoutingProxyRequest,
} from './routingProxyRequestParsing'
import {
  setRoutingProxyCorsHeaders,
  writeRoutingProxyJson,
} from './routingProxyResponses'
import {
  buildRoutingProxyHealth,
  buildRoutingProxyReadinessIssues,
  joinRoutingProxyPath,
} from './routingProxyHealth'
import type {
  RoutingProxyConfig,
  RoutingProxyService,
} from './routingProxyTypes'

export const createRoutingProxyMiddleware = (
  service: RoutingProxyService,
  pathname = DEFAULT_PROXY_PATH,
  config: RoutingProxyConfig | null = null,
) => {
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const routePath = pathname.replace(/\/+$/g, '')
    const healthPath = joinRoutingProxyPath(pathname, 'health')
    const readinessPath = joinRoutingProxyPath(pathname, 'ready')
    const isRouteRequest = url.pathname === pathname || url.pathname === routePath
    const isHealthRequest = url.pathname === healthPath
    const isReadinessRequest = url.pathname === readinessPath

    if (!isRouteRequest && !isHealthRequest && !isReadinessRequest) {
      next?.()
      return false
    }

    setRoutingProxyCorsHeaders(res)
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return true
    }

    if (req.method !== 'GET') {
      writeRoutingProxyJson(res, 405, { error: 'Method not allowed.' })
      return true
    }

    if (isHealthRequest) {
      writeRoutingProxyJson(res, 200, buildRoutingProxyHealth(pathname, config))
      return true
    }

    if (isReadinessRequest) {
      const issues = buildRoutingProxyReadinessIssues(config)
      writeRoutingProxyJson(
        res,
        issues.length === 0 ? 200 : 503,
        buildRoutingProxyHealth(pathname, config, issues),
      )
      return true
    }

    const {
      profile,
      mode,
      origin,
      destination,
      destinations,
    } = parseRoutingProxyRequest(url)

    if (!profile) {
      writeRoutingProxyJson(res, 400, { error: 'Missing or invalid profile.' })
      return true
    }
    if (!origin) {
      writeRoutingProxyJson(res, 400, { error: 'Missing or invalid origin.' })
      return true
    }

    if (mode === 'path') {
      if (!destination) {
        writeRoutingProxyJson(res, 400, { error: 'Missing or invalid destination.' })
        return true
      }

      return handleRoutingPathRequest({
        service,
        res,
        profile,
        origin,
        destination,
      })
    }

    if (destinations.length === 0) {
      writeRoutingProxyJson(res, 400, { error: 'Missing destinations.' })
      return true
    }

    return handleRoutingMatrixRequest({
      service,
      res,
      profile,
      origin,
      destinations,
    })
  }
}

export { parseCoordinate, parseCoordinates } from './routingProxyRequestParsing'
