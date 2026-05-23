import type { IncomingMessage, ServerResponse } from 'node:http'
import { DEFAULT_PARKING_ANSWER_PATH } from './parkingAnswerServiceDefaults'
import {
  buildParkingAnswerServiceDistrictReadiness,
  buildParkingAnswerServiceHealth,
  joinParkingAnswerServicePath,
} from './parkingAnswerServiceHealth'
import { parseParkingAnswerServiceRequest } from './parkingAnswerServiceParsing'
import {
  getParkingAnswerServiceErrorMessage,
  setParkingAnswerServiceCorsHeaders,
  writeParkingAnswerServiceJson,
} from './parkingAnswerServiceResponses'
import type {
  ParkingAnswerService,
  ParkingAnswerServiceConfig,
} from './parkingAnswerServiceTypes'

export const createParkingAnswerServiceMiddleware = (
  service: ParkingAnswerService,
  config: ParkingAnswerServiceConfig,
  pathname = DEFAULT_PARKING_ANSWER_PATH,
) => {
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const healthPath = joinParkingAnswerServicePath(pathname, 'health')
    const readinessPath = joinParkingAnswerServicePath(pathname, 'ready')
    const isAnswerRequest = url.pathname === pathname
    const isHealthRequest = url.pathname === healthPath
    const isReadinessRequest = url.pathname === readinessPath

    if (!isAnswerRequest && !isHealthRequest && !isReadinessRequest) {
      next?.()
      return false
    }

    setParkingAnswerServiceCorsHeaders(res)
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return true
    }

    if (req.method !== 'GET') {
      writeParkingAnswerServiceJson(res, 405, { error: 'Method not allowed.' })
      return true
    }

    if (isHealthRequest) {
      writeParkingAnswerServiceJson(
        res,
        200,
        buildParkingAnswerServiceHealth(config),
      )
      return true
    }

    if (isReadinessRequest) {
      const districts = await buildParkingAnswerServiceDistrictReadiness(config)
      const payload = buildParkingAnswerServiceHealth(config, districts)
      writeParkingAnswerServiceJson(
        res,
        payload.status === 'ok' ? 200 : 503,
        payload,
      )
      return true
    }

    const parsed = parseParkingAnswerServiceRequest(url, config)
    if (!parsed.ok) {
      writeParkingAnswerServiceJson(res, parsed.statusCode, {
        error: parsed.error,
      })
      return true
    }

    try {
      const payload = await service.answer(parsed.request)
      writeParkingAnswerServiceJson(res, 200, payload)
    } catch (error) {
      writeParkingAnswerServiceJson(res, 500, {
        error: getParkingAnswerServiceErrorMessage(error),
      })
    }

    return true
  }
}
