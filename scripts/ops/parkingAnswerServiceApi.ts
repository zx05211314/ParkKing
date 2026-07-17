import { PARKING_ANSWER_SCHEMA_VERSION } from './parkingAnswerServiceDefaults'
import type {
  ParkingAnswerService,
  ParkingAnswerServiceDependencies,
  ParkingAnswerServiceRequest,
} from './parkingAnswerServiceTypes'
import {
  createPreparedQueryParkingAnswerRunner,
  createQueryParkingAnswerRunner,
  loadEvaluatedSegmentsForAnswer,
  loadPreparedSegmentsForAnswer,
  type EvaluatedSegmentsForAnswer,
  type PreparedSegmentsForAnswer,
  type QueryParkingAnswerLoader,
  type QueryParkingAnswerPreparedLoader,
} from './queryParkingAnswer'

const toQueryOptions = ({
  datasetDir,
  lng,
  lat,
  hhmm,
  searchRadiusMeters,
  includeInferred,
  riskMode,
  maxAlternatives,
}: ParkingAnswerServiceRequest) => ({
  datasetDir,
  lng,
  lat,
  hhmm,
  searchRadiusMeters,
  includeInferred,
  riskMode,
  maxAlternatives,
})

export const createCachedParkingAnswerLoader = (
  loadSegments: QueryParkingAnswerLoader = loadEvaluatedSegmentsForAnswer,
): QueryParkingAnswerLoader => {
  const cache = new Map<string, Promise<EvaluatedSegmentsForAnswer>>()

  return (datasetDir, hhmm) => {
    const key = `${datasetDir}\u0000${hhmm}`
    const cached = cache.get(key)
    if (cached) {
      return cached
    }

    const loaded = loadSegments(datasetDir, hhmm).catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, loaded)
    return loaded
  }
}

export const createCachedPreparedParkingAnswerLoader = (
  loadSegments: QueryParkingAnswerPreparedLoader = loadPreparedSegmentsForAnswer,
): QueryParkingAnswerPreparedLoader => {
  const cache = new Map<string, Promise<PreparedSegmentsForAnswer>>()

  return (datasetDir) => {
    const cached = cache.get(datasetDir)
    if (cached) {
      return cached
    }

    const loaded = loadSegments(datasetDir).catch((error) => {
      cache.delete(datasetDir)
      throw error
    })
    cache.set(datasetDir, loaded)
    return loaded
  }
}

export const createParkingAnswerServiceApi = (
  dependencies: ParkingAnswerServiceDependencies = {},
): ParkingAnswerService => {
  const queryParkingAnswer =
    dependencies.queryParkingAnswer ??
    (dependencies.loadEvaluatedSegmentsForAnswer
      ? createQueryParkingAnswerRunner(
          createCachedParkingAnswerLoader(
            dependencies.loadEvaluatedSegmentsForAnswer,
          ),
        )
      : createPreparedQueryParkingAnswerRunner(
          createCachedPreparedParkingAnswerLoader(
            dependencies.loadPreparedSegmentsForAnswer ??
              loadPreparedSegmentsForAnswer,
          ),
        ))

  return {
    async answer(request) {
      const result = await queryParkingAnswer(toQueryOptions(request))
      return {
        schemaVersion: PARKING_ANSWER_SCHEMA_VERSION,
        district: request.district,
        ...result,
      }
    },
  }
}
