import { PARKING_ANSWER_SCHEMA_VERSION } from './parkingAnswerServiceDefaults'
import type {
  ParkingAnswerService,
  ParkingAnswerServiceDependencies,
  ParkingAnswerServiceRequest,
} from './parkingAnswerServiceTypes'
import {
  createQueryParkingAnswerRunner,
  loadEvaluatedSegmentsForAnswer,
  type EvaluatedSegmentsForAnswer,
  type QueryParkingAnswerLoader,
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

export const createParkingAnswerServiceApi = (
  dependencies: ParkingAnswerServiceDependencies = {},
): ParkingAnswerService => {
  const queryParkingAnswer =
    dependencies.queryParkingAnswer ??
    createQueryParkingAnswerRunner(
      createCachedParkingAnswerLoader(
        dependencies.loadEvaluatedSegmentsForAnswer ?? loadEvaluatedSegmentsForAnswer,
      ),
    )

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
