import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import { resolveParkingAnswerServiceConfig } from './parkingAnswerServiceConfig'
import { createParkingAnswerServiceApi } from './parkingAnswerServiceApi'
import { createParkingAnswerServiceMiddleware } from './parkingAnswerServiceMiddleware'
import type {
  ParkingAnswerServiceConfig,
  ParkingAnswerServiceDependencies,
} from './parkingAnswerServiceTypes'

export {
  createParkingAnswerServiceApi,
  createParkingAnswerServiceMiddleware,
  resolveParkingAnswerServiceConfig,
}
export {
  buildParkingAnswerServiceDistrictReadiness,
  buildParkingAnswerServiceHealth,
  joinParkingAnswerServicePath,
} from './parkingAnswerServiceHealth'
export type * from './parkingAnswerServiceTypes'

export const createParkingAnswerService = (
  dependencies: ParkingAnswerServiceDependencies = {},
) => createParkingAnswerServiceApi(dependencies)

export const startParkingAnswerServiceServer = (
  config: ParkingAnswerServiceConfig = resolveParkingAnswerServiceConfig(),
  dependencies: ParkingAnswerServiceDependencies = {},
) => {
  const service = createParkingAnswerService(dependencies)
  const middleware = createParkingAnswerServiceMiddleware(service, config, config.path)

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
  const config = resolveParkingAnswerServiceConfig()
  const server = startParkingAnswerServiceServer(config)
  server.on('listening', () => {
    console.log(
      `Parking answer service listening on http://localhost:${config.port}${config.path} (districts ${config.allowedDistricts.join(',')}, root ${config.districtDatasetRoot})`,
    )
  })
}
