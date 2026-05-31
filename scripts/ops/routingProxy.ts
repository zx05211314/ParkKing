import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { resolveRoutingProxyConfig } from './routingProxyConfig'
import { createRoutingProxyMiddleware } from './routingProxyMiddleware'
import { createRoutingProxyRuntime } from './routingProxyRuntime'
import { createRoutingProxyServiceApi } from './routingProxyServiceApi'
import type {
  RoutingProxyConfig,
  RoutingProxyDependencies,
} from './routingProxyTypes'

export { createRoutingProxyMiddleware, resolveRoutingProxyConfig }
export type * from './routingProxyTypes'

export const createRoutingProxyService = (
  config: RoutingProxyConfig,
  dependencies: RoutingProxyDependencies = {},
) => createRoutingProxyServiceApi(config, createRoutingProxyRuntime(config, dependencies))

export const startRoutingProxyServer = (
  config: RoutingProxyConfig = resolveRoutingProxyConfig(),
  dependencies: RoutingProxyDependencies = {},
) => {
  const service = createRoutingProxyService(config, dependencies)
  const middleware = createRoutingProxyMiddleware(service, config.path, config)

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
  const config = resolveRoutingProxyConfig()
  const server = startRoutingProxyServer(config)
  server.on('listening', () => {
    console.log(
      `Routing proxy listening on http://localhost:${config.port}${config.path} (cache ${config.cacheFile})`,
    )
  })
}
