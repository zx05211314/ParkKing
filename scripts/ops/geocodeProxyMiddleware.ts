import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  DEFAULT_PROXY_LIMIT,
  DEFAULT_PROXY_PATH,
} from './geocodeProxyDefaults'
import {
  normalizeGeocodeText,
  parsePositiveInteger,
} from './geocodeProxyParsing'
import {
  buildGeocodeProxyHealth,
  buildGeocodeProxyReadinessIssues,
  joinGeocodeProxyPath,
} from './geocodeProxyHealth'
import type {
  GeocodeProxyConfig,
  GeocodeProxyService,
} from './geocodeProxyTypes'

const writeJson = (res: ServerResponse, statusCode: number, body: unknown) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

const setCorsHeaders = (res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
}

export const createGeocodeProxyMiddleware = (
  service: GeocodeProxyService,
  pathname = DEFAULT_PROXY_PATH,
  config: GeocodeProxyConfig | null = null,
) => {
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const searchPath = pathname.replace(/\/+$/g, '')
    const healthPath = joinGeocodeProxyPath(pathname, 'health')
    const readinessPath = joinGeocodeProxyPath(pathname, 'ready')
    const isSearchRequest = url.pathname === pathname || url.pathname === searchPath
    const isHealthRequest = url.pathname === healthPath
    const isReadinessRequest = url.pathname === readinessPath

    if (!isSearchRequest && !isHealthRequest && !isReadinessRequest) {
      next?.()
      return false
    }

    setCorsHeaders(res)
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return true
    }

    if (req.method !== 'GET') {
      writeJson(res, 405, { error: 'Method not allowed.' })
      return true
    }

    if (isHealthRequest) {
      writeJson(res, 200, buildGeocodeProxyHealth(pathname, config))
      return true
    }

    if (isReadinessRequest) {
      const issues = buildGeocodeProxyReadinessIssues(config)
      writeJson(
        res,
        issues.length === 0 ? 200 : 503,
        buildGeocodeProxyHealth(pathname, config, issues),
      )
      return true
    }

    const query = url.searchParams.get('q')?.trim() ?? ''
    if (!query) {
      writeJson(res, 400, { error: 'Missing q query parameter.' })
      return true
    }

    try {
      const requestedLimit = normalizeGeocodeText(url.searchParams.get('limit'))
      const payload = await service.search({
        query,
        viewbox: normalizeGeocodeText(url.searchParams.get('viewbox')),
        bounded: url.searchParams.get('bounded') === '1',
        limit: requestedLimit
          ? parsePositiveInteger(requestedLimit, DEFAULT_PROXY_LIMIT)
          : undefined,
      })
      writeJson(res, 200, payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Geocoder proxy request failed.'
      writeJson(res, 502, { error: message })
    }

    return true
  }
}
