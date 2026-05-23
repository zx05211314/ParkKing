import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { resolveGeocodeProxyConfig } from './geocodeProxyConfig'
import { createGeocodeProxyMiddleware } from './geocodeProxyMiddleware'
import { createGeocodeProxyRuntime } from './geocodeProxyRuntime'
import { createGeocodeProxyServiceApi } from './geocodeProxyServiceApi'
import type {
  GeocodeProxyConfig,
  GeocodeProxyDependencies,
} from './geocodeProxyTypes'

export { createGeocodeProxyMiddleware, resolveGeocodeProxyConfig }
export type * from './geocodeProxyTypes'

export const createGeocodeProxyService = (
  config: GeocodeProxyConfig,
  dependencies: GeocodeProxyDependencies = {},
) => createGeocodeProxyServiceApi(config, createGeocodeProxyRuntime(config, dependencies))

export const startGeocodeProxyServer = (
  config: GeocodeProxyConfig = resolveGeocodeProxyConfig(),
  dependencies: GeocodeProxyDependencies = {},
) => {
  const service = createGeocodeProxyService(config, dependencies)
  const middleware = createGeocodeProxyMiddleware(service, config.path, config)

  const server = createServer((req, res) => {
    void middleware(req, res, () => {
      res.statusCode = 404
      res.end('Not found')
    })
  })

  server.listen(config.port)
  return server
}

const isMainModule = () => {
  const entry = process.argv[1]
  return entry ? pathToFileURL(entry).href === import.meta.url : false
}

if (isMainModule()) {
  const config = resolveGeocodeProxyConfig()
  const server = startGeocodeProxyServer(config)
  server.on('listening', () => {
    console.log(
      `Geocode proxy listening on http://localhost:${config.port}${config.path} (cache ${config.cacheFile})`,
    )
  })
}
