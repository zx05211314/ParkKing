import type { ParkingAnswer } from '../domain/answers/parkingAnswer'
import type { RiskMode } from '../domain/ranking/rank'
import type { ParkingAnswerTrustSummary } from '../ui/parkingAnswerPresentation'
import {
  createEndpointUrl,
  fetchJson,
  getApiErrorMessage,
  normalizeOptionalText,
  readViteEnv,
  resolveLocalhostProxyEndpoint,
  type ViteEnvLike,
} from './client'

const LOCAL_PROXY_PATH = '/api/parking-answer'
export const PARKING_ANSWER_API_UNAVAILABLE_MESSAGE =
  'Parking answer API is not configured for this deployment. Exact answers will use the local loaded dataset fallback.'
export const PARKING_ANSWER_API_DEGRADED_MESSAGE =
  'Parking answer API readiness is degraded. Exact answers will use the local loaded dataset fallback.'

export interface ParkingAnswerApiProviderConfig {
  endpoint: string
}

export interface ParkingAnswerApiConfig {
  primary: ParkingAnswerApiProviderConfig
}

export interface ParkingAnswerApiRuntimeAvailability {
  available: boolean
  message: string | null
}

export interface ParkingAnswerApiDistrictReadiness {
  district: string
  datasetDir: string
  ready: boolean
  missingFiles: string[]
  invalidFiles: string[]
}

export interface ParkingAnswerApiReadinessResponse {
  schemaVersion: 1
  service: 'parking-answer'
  status: 'ok' | 'degraded'
  districts?: ParkingAnswerApiDistrictReadiness[]
}

export interface ParkingAnswerApiRequest {
  district: string
  location: [number, number]
  hhmm: string
  searchRadiusMeters?: number
  includeInferred?: boolean
  riskMode?: RiskMode
  maxAlternatives?: number
}

export interface ParkingAnswerApiResponse {
  schemaVersion: 1
  district: string | null
  datasetDir: string
  datasetHash: string
  hhmm: string
  evaluatedCount: number
  answer: ParkingAnswer
  trustSummary: ParkingAnswerTrustSummary
}

interface SearchParkingAnswerOptions {
  config?: ParkingAnswerApiConfig
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

const formatCoordinate = ([lng, lat]: [number, number]) => `${lng},${lat}`

const appendEndpointPath = (endpoint: string, suffix: string) => {
  const url = createEndpointUrl(endpoint)
  url.pathname = `${url.pathname.replace(/\/+$/g, '')}/${suffix.replace(/^\/+/g, '')}`
  url.search = ''
  return url.toString()
}

export const resolveParkingAnswerApiConfig = (
  env: ViteEnvLike = readViteEnv(),
): ParkingAnswerApiConfig => ({
  primary: {
    endpoint:
      normalizeOptionalText(env.VITE_PARKING_ANSWER_URL) ??
      resolveLocalhostProxyEndpoint(LOCAL_PROXY_PATH) ??
      LOCAL_PROXY_PATH,
  },
})

const isImplicitLocalProxyConfig = (
  config: ParkingAnswerApiConfig,
  env: ViteEnvLike = readViteEnv(),
) =>
  config.primary.endpoint === LOCAL_PROXY_PATH &&
  normalizeOptionalText(env.VITE_PARKING_ANSWER_URL) === null &&
  resolveLocalhostProxyEndpoint(LOCAL_PROXY_PATH) === null

export const getParkingAnswerApiRuntimeAvailability = (
  config: ParkingAnswerApiConfig = resolveParkingAnswerApiConfig(),
  env: ViteEnvLike = readViteEnv(),
): ParkingAnswerApiRuntimeAvailability => {
  if (
    typeof window !== 'undefined' &&
    isImplicitLocalProxyConfig(config, env)
  ) {
    return {
      available: false,
      message: PARKING_ANSWER_API_UNAVAILABLE_MESSAGE,
    }
  }

  return {
    available: true,
    message: null,
  }
}

export const buildParkingAnswerApiUrl = (
  request: ParkingAnswerApiRequest,
  provider: ParkingAnswerApiProviderConfig = resolveParkingAnswerApiConfig().primary,
) => {
  const url = createEndpointUrl(provider.endpoint)
  url.searchParams.set('district', request.district)
  url.searchParams.set('location', formatCoordinate(request.location))
  url.searchParams.set('hhmm', request.hhmm)
  if (request.searchRadiusMeters !== undefined) {
    url.searchParams.set('radius', String(request.searchRadiusMeters))
  }
  if (request.includeInferred !== undefined) {
    url.searchParams.set('includeInferred', String(request.includeInferred))
  }
  if (request.riskMode) {
    url.searchParams.set('riskMode', request.riskMode)
  }
  if (request.maxAlternatives !== undefined) {
    url.searchParams.set('maxAlternatives', String(request.maxAlternatives))
  }
  return url.toString()
}

export const buildParkingAnswerReadinessUrl = (
  provider: ParkingAnswerApiProviderConfig = resolveParkingAnswerApiConfig().primary,
) => appendEndpointPath(provider.endpoint, 'ready')

const normalizeParkingAnswerApiResponse = (
  payload: unknown,
): ParkingAnswerApiResponse | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const result = payload as Partial<ParkingAnswerApiResponse>
  if (result.schemaVersion !== 1 || !result.answer || !result.trustSummary) {
    return null
  }
  return result as ParkingAnswerApiResponse
}

const normalizeParkingAnswerReadinessResponse = (
  payload: unknown,
): ParkingAnswerApiReadinessResponse | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const result = payload as Partial<ParkingAnswerApiReadinessResponse>
  if (
    result.schemaVersion !== 1 ||
    result.service !== 'parking-answer' ||
    (result.status !== 'ok' && result.status !== 'degraded')
  ) {
    return null
  }
  return {
    schemaVersion: 1,
    service: 'parking-answer',
    status: result.status,
    districts: Array.isArray(result.districts)
      ? result.districts.map((district) => ({
          district: String(district.district ?? ''),
          datasetDir: String(district.datasetDir ?? ''),
          ready: district.ready === true,
          missingFiles: Array.isArray(district.missingFiles)
            ? district.missingFiles.filter((fileName) => typeof fileName === 'string')
            : [],
          invalidFiles: Array.isArray(district.invalidFiles)
            ? district.invalidFiles.filter((fileName) => typeof fileName === 'string')
            : [],
        }))
      : undefined,
  }
}

const formatReadinessIssue = (district: ParkingAnswerApiDistrictReadiness) => {
  const issues = [
    district.missingFiles.length > 0
      ? `missing ${district.missingFiles.join(', ')}`
      : null,
    district.invalidFiles.length > 0
      ? `invalid ${district.invalidFiles.join(', ')}`
      : null,
  ].filter(Boolean)
  return issues.length > 0 ? `${district.district}: ${issues.join('; ')}` : null
}

const formatReadinessErrorMessage = (
  readiness: ParkingAnswerApiReadinessResponse,
) => {
  const issues = readiness.districts
    ?.filter((district) => !district.ready)
    .map(formatReadinessIssue)
    .filter(Boolean)
  return issues && issues.length > 0
    ? `${PARKING_ANSWER_API_DEGRADED_MESSAGE} ${issues.join(' | ')}.`
    : PARKING_ANSWER_API_DEGRADED_MESSAGE
}

export class ParkingAnswerReadinessError extends Error {
  readiness: ParkingAnswerApiReadinessResponse

  constructor(readiness: ParkingAnswerApiReadinessResponse) {
    super(formatReadinessErrorMessage(readiness))
    this.name = 'ParkingAnswerReadinessError'
    this.readiness = readiness
  }
}

export const checkParkingAnswerReadiness = async (
  options: SearchParkingAnswerOptions = {},
): Promise<ParkingAnswerApiReadinessResponse> => {
  const fetchImpl = options.fetchImpl ?? fetch
  const config = options.config ?? resolveParkingAnswerApiConfig()
  const { response, payload } = await fetchJson(
    buildParkingAnswerReadinessUrl(config.primary),
    {
      fetchImpl,
      signal: options.signal,
    },
  )
  const readiness = normalizeParkingAnswerReadinessResponse(payload)

  if (readiness?.status === 'degraded') {
    throw new ParkingAnswerReadinessError(readiness)
  }

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        payload,
        `Parking answer readiness check failed with ${response.status}.`,
      ),
    )
  }

  if (!readiness) {
    throw new Error('Parking answer readiness API returned an invalid response.')
  }

  return readiness
}

export const searchParkingAnswer = async (
  request: ParkingAnswerApiRequest,
  options: SearchParkingAnswerOptions = {},
): Promise<ParkingAnswerApiResponse> => {
  const fetchImpl = options.fetchImpl ?? fetch
  const config = options.config ?? resolveParkingAnswerApiConfig()
  const { response, payload } = await fetchJson(
    buildParkingAnswerApiUrl(request, config.primary),
    {
      fetchImpl,
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        payload,
        `Parking answer request failed with ${response.status}.`,
      ),
    )
  }

  const result = normalizeParkingAnswerApiResponse(payload)
  if (!result) {
    throw new Error('Parking answer API returned an invalid response.')
  }
  return result
}
