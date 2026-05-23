import {
  createEndpointUrl,
  fetchJson,
  getApiErrorMessage,
} from './client'

export interface ServiceReadinessResponse {
  service: string
  status: 'ok' | 'degraded'
  issues: string[]
  payload: unknown
}

export interface CheckServiceReadinessOptions {
  endpoint: string
  expectedPath: string
  expectedService: string
  unavailableMessage: string
  degradedMessage: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export class ServiceReadinessError extends Error {
  readonly service: string
  readonly statusCode: number | null
  readonly issues: string[]

  constructor(params: {
    message: string
    service: string
    statusCode?: number | null
    issues?: string[]
  }) {
    super(params.message)
    this.name = 'ServiceReadinessError'
    this.service = params.service
    this.statusCode = params.statusCode ?? null
    this.issues = params.issues ?? []
  }
}

const normalizePath = (value: string) => value.replace(/\/+$/g, '')
const isAbsoluteHttpEndpoint = (endpoint: string) => /^https?:\/\//i.test(endpoint)
const isSameOriginEndpoint = (url: URL) =>
  typeof window !== 'undefined' && url.origin === window.location.origin

export const isParkKingServiceEndpoint = (
  endpoint: string,
  expectedPath: string,
) => {
  const url = createEndpointUrl(endpoint)
  return (
    normalizePath(url.pathname) === normalizePath(expectedPath) &&
    (!isAbsoluteHttpEndpoint(endpoint) || isSameOriginEndpoint(url))
  )
}

export const buildServiceReadinessUrl = (endpoint: string) => {
  const url = createEndpointUrl(endpoint)
  url.pathname = `${normalizePath(url.pathname)}/ready`
  url.search = ''
  return url.toString()
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const normalizeIssues = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []

const buildDegradedMessage = (baseMessage: string, issues: string[]) =>
  issues.length > 0 ? `${baseMessage}: ${issues.join('; ')}` : baseMessage

export const checkServiceReadiness = async ({
  endpoint,
  expectedPath,
  expectedService,
  unavailableMessage,
  degradedMessage,
  fetchImpl = fetch,
  signal,
}: CheckServiceReadinessOptions): Promise<ServiceReadinessResponse | null> => {
  if (!isParkKingServiceEndpoint(endpoint, expectedPath)) {
    return null
  }

  const readinessUrl = buildServiceReadinessUrl(endpoint)
  const { response, payload } = await fetchJson(readinessUrl, {
    fetchImpl,
    signal,
  })
  const record = toRecord(payload)
  const service =
    typeof record?.service === 'string' ? record.service : expectedService
  const issues = normalizeIssues(record?.issues)

  if (response.status === 404) {
    throw new ServiceReadinessError({
      message: unavailableMessage,
      service,
      statusCode: response.status,
      issues,
    })
  }

  if (!response.ok) {
    throw new ServiceReadinessError({
      message: getApiErrorMessage(
        payload,
        buildDegradedMessage(degradedMessage, issues),
      ),
      service,
      statusCode: response.status,
      issues,
    })
  }

  if (
    !record ||
    record.service !== expectedService ||
    (record.status !== 'ok' && record.status !== 'degraded')
  ) {
    throw new ServiceReadinessError({
      message: `${degradedMessage}: readiness response was malformed`,
      service,
      statusCode: response.status,
      issues,
    })
  }

  if (record.status !== 'ok') {
    throw new ServiceReadinessError({
      message: buildDegradedMessage(degradedMessage, issues),
      service,
      statusCode: response.status,
      issues,
    })
  }

  return {
    service: record.service,
    status: record.status,
    issues,
    payload,
  }
}
