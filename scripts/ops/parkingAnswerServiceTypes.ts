import type { RiskMode } from '../../src/domain/ranking/rank'
import type {
  QueryParkingAnswerLoader,
  QueryParkingAnswerOptions,
  QueryParkingAnswerResult,
} from './queryParkingAnswer'

export interface ParkingAnswerServiceConfig {
  path: string
  port: number
  districtDatasetRoot: string
  defaultDistrict: string
  allowedDistricts: string[]
  defaultHhmm: string
  allowDatasetDirParam: boolean
}

export interface ParkingAnswerServiceDistrictReadiness {
  district: string
  datasetDir: string
  ready: boolean
  missingFiles: string[]
  invalidFiles: string[]
}

export interface ParkingAnswerServiceHealthResponse {
  schemaVersion: 1
  service: 'parking-answer'
  status: 'ok' | 'degraded'
  answerPath: string
  healthPath: string
  readinessPath: string
  defaultDistrict: string
  allowedDistricts: string[]
  defaultHhmm: string
  datasetRoot: string
  allowDatasetDirParam: boolean
  districts?: ParkingAnswerServiceDistrictReadiness[]
}

export interface ParkingAnswerServiceRequest {
  district: string | null
  datasetDir: string
  lng: number
  lat: number
  hhmm: string
  searchRadiusMeters?: number
  includeInferred?: boolean
  riskMode?: RiskMode
  maxAlternatives?: number
}

export interface ParkingAnswerServiceResponse extends QueryParkingAnswerResult {
  schemaVersion: 1
  district: string | null
}

export interface ParkingAnswerService {
  answer(
    request: ParkingAnswerServiceRequest,
  ): Promise<ParkingAnswerServiceResponse>
}

export interface ParkingAnswerServiceDependencies {
  loadEvaluatedSegmentsForAnswer?: QueryParkingAnswerLoader
  queryParkingAnswer?: (
    options: QueryParkingAnswerOptions,
  ) => Promise<QueryParkingAnswerResult>
}

export interface ParkingAnswerRequestParseError {
  ok: false
  statusCode: number
  error: string
}

export interface ParkingAnswerRequestParseSuccess {
  ok: true
  request: ParkingAnswerServiceRequest
}

export type ParkingAnswerRequestParseResult =
  | ParkingAnswerRequestParseError
  | ParkingAnswerRequestParseSuccess
