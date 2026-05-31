import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { resolveSyncServiceConfig } from './syncServiceConfig'
import { createSyncServiceApi } from './syncServiceApi'
import { createSyncServiceMiddleware } from './syncServiceMiddleware'
import { createSyncServiceRuntime } from './syncServiceRuntime'
import type { SyncServiceConfig } from './syncServiceTypes'

export { createSyncServiceMiddleware, resolveSyncServiceConfig }
export type * from './syncServiceTypes'

export const createSyncService = (config: SyncServiceConfig) =>
  createSyncServiceApi(config, createSyncServiceRuntime(config))

export const startSyncServiceServer = (
  config: SyncServiceConfig = resolveSyncServiceConfig(),
) => {
  const service = createSyncService(config)
  const middleware = createSyncServiceMiddleware(
    service,
    config.path,
    config.defaultScope,
    config,
  )

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
  const config = resolveSyncServiceConfig()
  const server = startSyncServiceServer(config)
  server.on('listening', () => {
    console.log(
      `Sync service listening on http://localhost:${config.port}${config.path} (store ${config.storageFile})`,
    )
  })
}
