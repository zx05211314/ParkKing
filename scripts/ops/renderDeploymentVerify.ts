import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RenderDeploymentHandoffDataset } from './renderDeploymentHandoff'
import {
  renderSmokeApiServicesSummary,
  runSmokeApiServices,
  type SmokeApiServiceId,
  type SmokeApiServicesSummary,
} from './smokeApiServices'
import {
  REQUIRED_RENDER_RUNTIME_ENV,
  renderEnvAssignments,
} from './renderDeploymentEnv'
import {
  buildSmokeParkingAnswerServiceCaseResult,
  type SmokeParkingAnswerServiceCaseResult,
} from './smokeParkingAnswerService'
import {
  loadSmokeExactParkingAnswerCases,
  type SmokeExactParkingAnswerCase,
} from './smokeExactParkingAnswers'

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_READINESS_TIMEOUT_MS = 30_000
const DEFAULT_ANSWER_CASES_DIR = 'configs/prod'
const DEFAULT_TRANSIENT_MAX_ATTEMPTS = 3
const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 500

export interface RenderDeploymentVerifyOptions {
  appUrl?: string | null
  handoffJsonPath?: string | null
  manifestPath?: string | null
  manifestUrl?: string | null
  downloadToken?: string | null
  downloadAuthHeader?: string | null
  timeoutMs?: number | null
  readinessTimeoutMs?: number | null
  skipApiServices?: boolean | null
  apiServices?: SmokeApiServiceId[] | null
  syncIssueRoundtrip?: boolean | null
  syncCorsCheck?: boolean | null
  answerCasesDir?: string | null
  skipParkingAnswerCases?: boolean | null
  allParkingAnswerCases?: boolean | null
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface RenderDeploymentVerifyDistrict {
  districtId: string
  expectedDatasetHash: string
  expectedPublishedAt: string
  actualDatasetHash: string | null
  actualPublishedAt: string | null
  latestDatasetHash: string | null
  latestPublishedAt: string | null
  ready: boolean | null
  pass: boolean
  errors: string[]
}

export interface RenderDeploymentVerifyResult {
  pass: boolean
  appUrl: string
  readinessUrl: string
  contractSource: string
  releaseId: string | null
  releaseTag: string | null
  status: number | null
  serviceStatus: string | null
  readinessTimeoutMs: number
  readinessAttempts: number
  expectedDatasets: RenderDeploymentHandoffDataset[]
  districts: RenderDeploymentVerifyDistrict[]
  unexpectedDistricts: string[]
  apiServices?: SmokeApiServicesSummary | null
  parkingAnswers?: RenderDeploymentVerifyParkingAnswerResult[] | null
  syncCors?: RenderDeploymentVerifySyncCorsResult | null
  syncBoundary?: RenderDeploymentVerifySyncBoundaryResult | null
  proxyRuntime?: RenderDeploymentVerifyProxyRuntimeResult[] | null
  releasePackageRemediation: RenderDeploymentVerifyRemediation | null
  remediation: RenderDeploymentVerifyRemediation | null
  errors: string[]
}

export interface RenderDeploymentVerifySyncCorsResult {
  pass: boolean
  url: string
  untrustedOrigin: string
  status: number
  allowOrigin: string | null
  errors: string[]
}

export interface RenderDeploymentVerifySyncBoundaryResult {
  pass: boolean
  healthUrl: string
  mode: string | null
  durability: string | null
  capabilities: Record<string, boolean> | null
  protectedResources: Array<{
    resource: 'saved-plans' | 'reports' | 'issues'
    url: string
    status: number
  }>
  errors: string[]
}

export interface RenderDeploymentVerifyParkingAnswerResult
  extends SmokeParkingAnswerServiceCaseResult {
  districtId: string
  url: string
  datasetHash: string | null
  elapsedMs: number
  attempts: number
}

export interface RenderDeploymentVerifyProxyRuntimeResult {
  service: Extract<SmokeApiServiceId, 'geocode' | 'routing'>
  pass: boolean
  url: string
  status: number
  serviceStatus: string | null
  requestTimeoutMs: number | null
  errors: string[]
}

export interface RenderDeploymentVerifyRemediation {
  reasons: string[]
  requiredRenderEnv: Record<string, string>
  steps: string[]
  verifyCommand: string
}

interface FetchJsonResult {
  status: number
  payload: unknown
}

interface ExpectedDatasetContract {
  contractSource: string
  verifyArgName: '--handoff-json' | '--manifest' | '--manifest-url'
  releaseId: string | null
  releaseTag: string | null
  releasePackageUrl: string | null
  releaseManifestUrl: string | null
  expectedDatasets: RenderDeploymentHandoffDataset[]
  errors: string[]
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

const parsePositiveInteger = (value: string | null, label: string) => {
  if (value === null) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const DEFAULT_API_SERVICES: SmokeApiServiceId[] = [
  'geocode',
  'routing',
  'sync',
  'parking-answer',
]

const parseApiServices = (value: string | null): SmokeApiServiceId[] | null => {
  if (!value) {
    return null
  }
  const services = value
    .split(',')
    .map((service) => service.trim())
    .filter(Boolean)
  const invalid = services.filter(
    (service) => !DEFAULT_API_SERVICES.includes(service as SmokeApiServiceId),
  )
  if (invalid.length > 0) {
    throw new Error(`Unknown API services: ${invalid.join(', ')}`)
  }
  return services as SmokeApiServiceId[]
}

export const parseRenderDeploymentVerifyArgs = (
  argv: string[],
): RenderDeploymentVerifyOptions => {
  const timeoutMs =
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? DEFAULT_TIMEOUT_MS
  const readinessTimeoutMs =
    parsePositiveInteger(
      getArgValue(argv, '--readiness-timeout-ms', '--readinessTimeoutMs'),
      'readiness-timeout-ms',
    ) ?? Math.max(DEFAULT_READINESS_TIMEOUT_MS, timeoutMs)

  return {
    appUrl:
      getArgValue(argv, '--app-url', '--appUrl', '--url') ??
      process.env.PARKKING_RENDER_APP_URL ??
      null,
    handoffJsonPath:
      getArgValue(argv, '--handoff-json', '--handoffJson') ?? null,
    manifestPath:
      getArgValue(argv, '--manifest', '--manifest-path', '--manifestPath') ?? null,
    manifestUrl:
      getArgValue(argv, '--manifest-url', '--manifestUrl') ??
      process.env.PARKKING_RELEASE_MANIFEST_URL ??
      null,
    downloadToken:
      getArgValue(argv, '--download-token', '--downloadToken') ??
      process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN ??
      null,
    downloadAuthHeader:
      getArgValue(argv, '--download-auth-header', '--downloadAuthHeader') ??
      process.env.PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER ??
      null,
    timeoutMs,
    readinessTimeoutMs,
    skipApiServices: hasFlag(argv, '--skip-api-services', '--skipApiServices'),
    apiServices: parseApiServices(
      getArgValue(argv, '--api-services', '--apiServices'),
    ),
    syncIssueRoundtrip:
      !hasFlag(argv, '--skip-sync-issue-roundtrip', '--skipSyncIssueRoundtrip'),
    syncCorsCheck: !hasFlag(argv, '--skip-sync-cors-check', '--skipSyncCorsCheck'),
    answerCasesDir:
      getArgValue(argv, '--answer-cases-dir', '--answerCasesDir') ??
      DEFAULT_ANSWER_CASES_DIR,
    skipParkingAnswerCases: hasFlag(
      argv,
      '--skip-parking-answer-cases',
      '--skipParkingAnswerCases',
    ),
    allParkingAnswerCases: hasFlag(
      argv,
      '--all-parking-answer-cases',
      '--allParkingAnswerCases',
    ),
    outPath: getArgValue(argv, '--out'),
    jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
  }
}

const readJsonFile = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getString = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'string' ? record[key] : null

const getBoolean = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'boolean' ? record[key] : null

const getExpectedDatasets = (
  handoff: Record<string, unknown>,
): RenderDeploymentHandoffDataset[] => {
  const rawEntries = handoff.expectedDatasets
  if (!Array.isArray(rawEntries)) {
    return []
  }
  return rawEntries
    .map((entry) => {
      const record = toRecord(entry)
      const districtId = getString(record, 'districtId')
      const datasetHash = getString(record, 'datasetHash')
      const publishedAt = getString(record, 'publishedAt')
      return districtId && datasetHash && publishedAt
        ? { districtId, datasetHash, publishedAt }
        : null
    })
    .filter((entry): entry is RenderDeploymentHandoffDataset => entry !== null)
    .sort((left, right) => left.districtId.localeCompare(right.districtId))
}

const getExpectedDatasetsFromManifest = (
  manifest: Record<string, unknown>,
): RenderDeploymentHandoffDataset[] => {
  const rawDistricts = manifest.districts
  if (!Array.isArray(rawDistricts)) {
    return []
  }
  return rawDistricts
    .map((entry) => {
      const record = toRecord(entry)
      const districtId = getString(record, 'districtId')
      const datasetHash = getString(record, 'datasetHash')
      const publishedAt = getString(record, 'publishedAt')
      return districtId && datasetHash && publishedAt
        ? { districtId, datasetHash, publishedAt }
        : null
    })
    .filter((entry): entry is RenderDeploymentHandoffDataset => entry !== null)
    .sort((left, right) => left.districtId.localeCompare(right.districtId))
}

const buildDownloadHeaders = (params: {
  downloadToken?: string | null
  downloadAuthHeader?: string | null
}) => {
  const headers: Record<string, string> = {
    'user-agent': 'ParkKing render deployment verifier',
  }
  if (params.downloadAuthHeader) {
    headers.authorization = params.downloadAuthHeader
  } else if (params.downloadToken) {
    headers.authorization = `Bearer ${params.downloadToken}`
  }
  return headers
}

const getDatasetIdentityContractErrors = (
  value: unknown,
  sourceLabel: string,
) => {
  if (!Array.isArray(value)) {
    return []
  }
  const incompleteEntries = value.flatMap((entry, index) => {
    const record = toRecord(entry)
    const districtId = getString(record, 'districtId') ?? `entry ${index + 1}`
    return getString(record, 'districtId') &&
      getString(record, 'datasetHash') &&
      getString(record, 'publishedAt')
      ? []
      : [districtId]
  })
  const districtIds = value.flatMap((entry) => {
    const districtId = getString(toRecord(entry), 'districtId')
    return districtId ? [districtId] : []
  })
  const duplicateDistricts = [
    ...new Set(
      districtIds.filter(
        (districtId, index) => districtIds.indexOf(districtId) !== index,
      ),
    ),
  ]
  return [
    ...(incompleteEntries.length > 0
      ? [
          `${sourceLabel} has incomplete district identities: ${incompleteEntries.join(', ')}`,
        ]
      : []),
    ...(duplicateDistricts.length > 0
      ? [
          `${sourceLabel} has duplicate district identities: ${duplicateDistricts.join(', ')}`,
        ]
      : []),
  ]
}

export const normalizeRenderAppUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    throw new Error('Render app URL is required. Pass --app-url or set PARKKING_RENDER_APP_URL.')
  }
  const url = new URL(trimmed)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Render app URL must be http(s): ${trimmed}`)
  }
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/+$/g, '')
}

const fetchJsonDocument = async (params: {
  url: string
  timeoutMs: number
  downloadToken?: string | null
  downloadAuthHeader?: string | null
}) => {
  const response = await fetch(params.url, {
    headers: buildDownloadHeaders(params),
    signal: AbortSignal.timeout(params.timeoutMs),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${params.url}: HTTP ${response.status}`)
  }
  return (await response.json()) as unknown
}

const fetchJsonWithTimeout = async (
  url: string,
  timeoutMs: number,
): Promise<FetchJsonResult> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    return {
      status: response.status,
      payload: await response.json().catch(() => null),
    }
  } finally {
    clearTimeout(timeout)
  }
}

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const fetchJsonWithTransientRetry = async (params: {
  url: string
  timeoutMs: number
  maxAttempts?: number
  retryDelayMs?: number
}) => {
  const maxAttempts = Math.max(
    1,
    Math.floor(params.maxAttempts ?? DEFAULT_TRANSIENT_MAX_ATTEMPTS),
  )
  const retryDelayMs = Math.max(
    0,
    params.retryDelayMs ?? DEFAULT_TRANSIENT_RETRY_DELAY_MS,
  )
  let attempts = 0
  while (attempts < maxAttempts) {
    attempts += 1
    try {
      const result = await fetchJsonWithTimeout(params.url, params.timeoutMs)
      if (result.status < 500 || attempts >= maxAttempts) {
        return { result, attempts, error: null }
      }
    } catch (error) {
      if (attempts >= maxAttempts) {
        return { result: null, attempts, error }
      }
    }
    await wait(retryDelayMs)
  }
  return {
    result: null,
    attempts,
    error: new Error('Transient retry loop completed without a response'),
  }
}

const loadExpectedDatasetContract = async (
  options: RenderDeploymentVerifyOptions,
  timeoutMs: number,
): Promise<ExpectedDatasetContract> => {
  const explicitHandoffJsonPath = options.handoffJsonPath?.trim()
  const manifestPath = options.manifestPath?.trim()
  const manifestUrl = options.manifestUrl?.trim()

  if (!explicitHandoffJsonPath && (manifestPath || manifestUrl)) {
    const source = manifestPath ? path.resolve(manifestPath) : manifestUrl ?? ''
    const parsed = toRecord(
      manifestPath
        ? await readJsonFile<Record<string, unknown>>(manifestPath)
        : await fetchJsonDocument({
            url: manifestUrl ?? '',
            timeoutMs,
            downloadToken: options.downloadToken,
            downloadAuthHeader: options.downloadAuthHeader,
          }),
    )
    const expectedDatasets = parsed ? getExpectedDatasetsFromManifest(parsed) : []
    const identityErrors = getDatasetIdentityContractErrors(
      parsed?.districts,
      `${source} districts`,
    )
    return {
      contractSource: source,
      verifyArgName: manifestPath ? '--manifest' : '--manifest-url',
      releaseId: getString(parsed, 'releaseId'),
      releaseTag: null,
      releasePackageUrl: null,
      releaseManifestUrl: manifestUrl ?? null,
      expectedDatasets,
      errors: [
        ...identityErrors,
        ...(expectedDatasets.length > 0
          ? []
          : [`${source} has no complete districts dataset identity contract`]),
      ],
    }
  }

  const handoffJsonPath = explicitHandoffJsonPath || DEFAULT_HANDOFF_JSON
  const handoff = await readJsonFile<Record<string, unknown>>(handoffJsonPath)
  const release = toRecord(handoff.release)
  const expectedDatasets = getExpectedDatasets(handoff)
  const identityErrors = getDatasetIdentityContractErrors(
    handoff.expectedDatasets,
    `${handoffJsonPath} expectedDatasets`,
  )
  return {
    contractSource: handoffJsonPath,
    verifyArgName: '--handoff-json',
    releaseId: getString(release, 'releaseId'),
    releaseTag: getString(release, 'tag'),
    releasePackageUrl: getString(handoff, 'packageUrl'),
    releaseManifestUrl: getString(handoff, 'manifestUrl'),
    expectedDatasets,
    errors: [
      ...(handoff.ready === true ? [] : [`${handoffJsonPath} is not marked ready`]),
      ...identityErrors,
      ...(expectedDatasets.length > 0
        ? []
        : [`${handoffJsonPath} has no complete expectedDatasets identity contract`]),
    ],
  }
}

const parseReadyDistricts = (payload: unknown) => {
  const record = toRecord(payload)
  const districts = record?.districts
  if (!Array.isArray(districts)) {
    return []
  }
  return districts
    .map((district) => {
      const entry = toRecord(district)
      const districtId = getString(entry, 'district')
      return districtId
        ? {
            districtId,
            datasetHash: getString(entry, 'datasetHash'),
            publishedAt: getString(entry, 'publishedAt'),
            latestDatasetHash: getString(entry, 'latestDatasetHash'),
            latestPublishedAt: getString(entry, 'latestPublishedAt'),
            ready: getBoolean(entry, 'ready'),
          }
        : null
    })
    .filter((entry): entry is {
      districtId: string
      datasetHash: string | null
      publishedAt: string | null
      latestDatasetHash: string | null
      latestPublishedAt: string | null
      ready: boolean | null
    } => entry !== null)
}

export const buildRenderReadinessUrl = (appUrl: string) =>
  new URL('/api/parking-answer/ready', `${appUrl}/`).toString()

export const buildRenderProxyReadyUrl = (
  appUrl: string,
  service: Extract<SmokeApiServiceId, 'geocode' | 'routing'>,
) =>
  new URL(service === 'geocode' ? '/api/geocode/ready' : '/api/route/ready', `${appUrl}/`).toString()

export const buildRenderSyncIssuesUrl = (appUrl: string) =>
  new URL('/api/sync/issues', `${appUrl}/`).toString()

const readBooleanRecord = (value: unknown) => {
  const record = toRecord(value)
  if (!record) {
    return null
  }
  const entries = Object.entries(record)
  return entries.every(([, entry]) => typeof entry === 'boolean')
    ? Object.fromEntries(entries) as Record<string, boolean>
    : null
}

export const verifyRenderSyncBoundary = async (params: {
  appUrl: string
  timeoutMs: number
}): Promise<RenderDeploymentVerifySyncBoundaryResult> => {
  const healthUrl = new URL('/api/sync/health', `${params.appUrl}/`).toString()
  const scope = `render-boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const protectedResources = (
    ['saved-plans', 'reports', 'issues'] as const
  ).map((resource) => ({
    resource,
    url: new URL(
      `/api/sync/${resource}?scope=${encodeURIComponent(scope)}`,
      `${params.appUrl}/`,
    ).toString(),
  }))

  try {
    const [health, ...resourceResponses] = await Promise.all([
      fetchJsonWithTimeout(healthUrl, params.timeoutMs),
      ...protectedResources.map((resource) =>
        fetchJsonWithTimeout(resource.url, params.timeoutMs),
      ),
    ])
    const healthPayload = toRecord(health.payload)
    const mode =
      typeof healthPayload?.mode === 'string' ? healthPayload.mode : null
    const durability =
      typeof healthPayload?.durability === 'string'
        ? healthPayload.durability
        : null
    const capabilities = readBooleanRecord(healthPayload?.capabilities)
    const probes = protectedResources.map((resource, index) => ({
      ...resource,
      status: resourceResponses[index]?.status ?? 0,
    }))
    const expectedCapabilities = {
      savedPlansRead: false,
      savedPlansWrite: false,
      reportsRead: false,
      reportsWrite: false,
      issueReportsRead: false,
      issueReportsWrite: true,
    }
    const errors = [
      ...(health.status === 200
        ? []
        : [`sync health expected HTTP 200, got ${health.status}`]),
      ...(mode === 'issue-upload-only'
        ? []
        : [`sync mode expected issue-upload-only, got ${mode ?? 'missing'}`]),
      ...(durability === 'ephemeral'
        ? []
        : [`sync durability expected ephemeral, got ${durability ?? 'missing'}`]),
      ...(capabilities &&
      Object.entries(expectedCapabilities).every(
        ([key, value]) => capabilities[key] === value,
      )
        ? []
        : ['sync health capabilities do not match the upload-only contract']),
      ...probes
        .filter((probe) => probe.status !== 403)
        .map(
          (probe) =>
            `${probe.resource} content endpoint expected HTTP 403, got ${probe.status}`,
        ),
    ]
    return {
      pass: errors.length === 0,
      healthUrl,
      mode,
      durability,
      capabilities,
      protectedResources: probes,
      errors,
    }
  } catch (error) {
    return {
      pass: false,
      healthUrl,
      mode: null,
      durability: null,
      capabilities: null,
      protectedResources: protectedResources.map((resource) => ({
        ...resource,
        status: 0,
      })),
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }
}

const buildRenderParkingAnswerUrl = (params: {
  appUrl: string
  districtId: string
  answerCase: SmokeExactParkingAnswerCase
}) => {
  const url = new URL('/api/parking-answer', `${params.appUrl}/`)
  url.searchParams.set('district', params.districtId)
  url.searchParams.set('lng', String(params.answerCase.lng))
  url.searchParams.set('lat', String(params.answerCase.lat))
  if (params.answerCase.hhmm) {
    url.searchParams.set('hhmm', params.answerCase.hhmm)
  }
  if (params.answerCase.searchRadiusMeters !== undefined) {
    url.searchParams.set('radius', String(params.answerCase.searchRadiusMeters))
  }
  if (params.answerCase.includeInferred !== undefined) {
    url.searchParams.set(
      'includeInferred',
      String(params.answerCase.includeInferred),
    )
  }
  return url.toString()
}

export const verifyRenderParkingAnswers = async (params: {
  appUrl: string
  timeoutMs: number
  answerCasesDir: string
  expectedDatasets: RenderDeploymentHandoffDataset[]
  allCases?: boolean
  maxAttempts?: number
  retryDelayMs?: number
}): Promise<RenderDeploymentVerifyParkingAnswerResult[]> => {
  const results: RenderDeploymentVerifyParkingAnswerResult[] = []
  const maxAttempts = Math.max(
    1,
    Math.floor(params.maxAttempts ?? DEFAULT_TRANSIENT_MAX_ATTEMPTS),
  )
  const retryDelayMs = Math.max(
    0,
    params.retryDelayMs ?? DEFAULT_TRANSIENT_RETRY_DELAY_MS,
  )
  for (const dataset of params.expectedDatasets) {
    const casesPath = path.resolve(
      params.answerCasesDir,
      `${dataset.districtId}.answer-cases.json`,
    )
    let answerCases: SmokeExactParkingAnswerCase[]
    try {
      const caseFile = await loadSmokeExactParkingAnswerCases(casesPath)
      if (caseFile.cases.length === 0) {
        throw new Error(`No reviewed answer cases found in ${casesPath}`)
      }
      answerCases = params.allCases ? caseFile.cases : caseFile.cases.slice(0, 1)
    } catch (error) {
      results.push({
        districtId: dataset.districtId,
        id: 'missing-reviewed-case',
        url: '',
        status: 0,
        datasetHash: null,
        elapsedMs: 0,
        attempts: 0,
        pass: false,
        errors: [error instanceof Error ? error.message : String(error)],
        expectedKind: '',
        coverageAreaId: null,
        answerKind: null,
        expectedEvidenceKind: null,
        evidenceKind: null,
        expectedPrimarySegmentId: null,
        primarySegmentId: null,
        trustLabel: null,
      })
      continue
    }

    for (const answerCase of answerCases) {
      const url = buildRenderParkingAnswerUrl({
        appUrl: params.appUrl,
        districtId: dataset.districtId,
        answerCase,
      })
      const startedAt = performance.now()
      let attempts = 0
      try {
        const fetchResult = await fetchJsonWithTransientRetry({
          url,
          timeoutMs: params.timeoutMs,
          maxAttempts,
          retryDelayMs,
        })
        attempts = fetchResult.attempts
        if (fetchResult.error) {
          throw fetchResult.error
        }
        const response = fetchResult.result
        if (!response) {
          throw new Error('Parking-answer request completed without a response')
        }
        const elapsedMs = Math.round(performance.now() - startedAt)
        const caseResult = buildSmokeParkingAnswerServiceCaseResult({
          answerCase,
          responseStatus: response.status,
          payload: response.payload,
          expectedDatasetHash: dataset.datasetHash,
        })
        results.push({
          districtId: dataset.districtId,
          url,
          datasetHash: getString(toRecord(response.payload), 'datasetHash'),
          elapsedMs,
          attempts,
          ...caseResult,
        })
      } catch (error) {
        results.push({
          districtId: dataset.districtId,
          id: answerCase.id,
          url,
          status: 0,
          datasetHash: null,
          elapsedMs: Math.round(performance.now() - startedAt),
          attempts,
          pass: false,
          errors: [error instanceof Error ? error.message : String(error)],
          expectedKind: answerCase.expectedKind,
          coverageAreaId: answerCase.coverageAreaId ?? null,
          answerKind: null,
          expectedEvidenceKind: answerCase.expectedEvidenceKind ?? null,
          evidenceKind: null,
          expectedPrimarySegmentId: answerCase.expectedPrimarySegmentId ?? null,
          primarySegmentId: null,
          trustLabel: null,
        })
      }
    }
  }
  return results
}

const getNumber = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'number' ? record[key] : null

export const verifyRenderProxyRuntimeConfig = async (params: {
  appUrl: string
  timeoutMs: number
  services?: Array<Extract<SmokeApiServiceId, 'geocode' | 'routing'>>
}): Promise<RenderDeploymentVerifyProxyRuntimeResult[]> => {
  const services = params.services ?? ['geocode', 'routing']
  const results: RenderDeploymentVerifyProxyRuntimeResult[] = []
  for (const service of services) {
    const url = buildRenderProxyReadyUrl(params.appUrl, service)
    try {
      const response = await fetchJsonWithTimeout(url, params.timeoutMs)
      const payload = toRecord(response.payload)
      const serviceStatus = getString(payload, 'status')
      const requestTimeoutMs = getNumber(payload, 'requestTimeoutMs')
      const errors = [
        ...(response.status === 200
          ? []
          : [`expected HTTP 200, got ${response.status}`]),
        ...(serviceStatus === 'ok'
          ? []
          : [`expected status ok, got ${serviceStatus ?? 'missing'}`]),
        ...(requestTimeoutMs !== null && requestTimeoutMs > 0
          ? []
          : ['requestTimeoutMs must be present and positive']),
      ]
      results.push({
        service,
        pass: errors.length === 0,
        url,
        status: response.status,
        serviceStatus,
        requestTimeoutMs,
        errors,
      })
    } catch (error) {
      results.push({
        service,
        pass: false,
        url,
        status: 0,
        serviceStatus: null,
        requestTimeoutMs: null,
        errors: [error instanceof Error ? error.message : String(error)],
      })
    }
  }
  return results
}

export const verifyRenderSyncCors = async (params: {
  appUrl: string
  timeoutMs: number
  untrustedOrigin?: string
}): Promise<RenderDeploymentVerifySyncCorsResult> => {
  const url = buildRenderSyncIssuesUrl(params.appUrl)
  const untrustedOrigin = params.untrustedOrigin ?? 'https://evil.example'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        origin: untrustedOrigin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Content-Type',
      },
      signal: controller.signal,
    })
    const allowOrigin = response.headers.get('access-control-allow-origin')
    const errors = [
      ...(response.status === 403
        ? []
        : [`expected HTTP 403 for untrusted Origin, got ${response.status}`]),
      ...(allowOrigin === null
        ? []
        : [`expected no Access-Control-Allow-Origin, got ${allowOrigin}`]),
    ]
    return {
      pass: errors.length === 0,
      url,
      untrustedOrigin,
      status: response.status,
      allowOrigin,
      errors,
    }
  } catch (error) {
    return {
      pass: false,
      url,
      untrustedOrigin,
      status: 0,
      allowOrigin: null,
      errors: [error instanceof Error ? error.message : String(error)],
    }
  } finally {
    clearTimeout(timeout)
  }
}

const quoteCommandArg = (value: string) =>
  /^[A-Za-z0-9_/:.?=&%#@+-]+$/.test(value)
    ? value
    : `"${value.replace(/`/g, '``').replace(/"/g, '`"')}"`

const buildRenderDeploymentVerifyCommand = (params: {
  appUrl: string
  contract: ExpectedDatasetContract
  allParkingAnswerCases: boolean
}) =>
  `npm run ops:render-deployment-verify -- --app-url ${quoteCommandArg(
    params.appUrl,
  )} ${params.contract.verifyArgName} ${quoteCommandArg(params.contract.contractSource)}${
    params.allParkingAnswerCases ? ' --all-parking-answer-cases' : ''
  }`

const buildRuntimeRemediation = (params: {
  appUrl: string
  contract: ExpectedDatasetContract
  allParkingAnswerCases: boolean
  syncCors: RenderDeploymentVerifySyncCorsResult | null
  syncBoundary: RenderDeploymentVerifySyncBoundaryResult | null
  proxyRuntime: RenderDeploymentVerifyProxyRuntimeResult[] | null
}): RenderDeploymentVerifyRemediation | null => {
  const reasons: string[] = []
  if (params.syncCors && !params.syncCors.pass) {
    reasons.push(
      `Sync CORS rejected-origin check failed at ${params.syncCors.url}; set PARKKING_SYNC_CORS_ORIGINS to the deployed app origin instead of wildcard.`,
    )
  }
  if (params.syncBoundary && !params.syncBoundary.pass) {
    reasons.push(
      `Production sync boundary check failed at ${params.syncBoundary.healthUrl}; enforce issue-upload-only mode with ephemeral durability and block content reads.`,
    )
  }
  const proxyTimeoutFailures =
    params.proxyRuntime?.filter(
      (entry) =>
        !entry.pass &&
        entry.errors.some((error) =>
          error.includes('requestTimeoutMs must be present and positive'),
        ),
    ) ?? []
  if (proxyTimeoutFailures.length > 0) {
    reasons.push(
      `Proxy readiness is missing positive requestTimeoutMs for ${proxyTimeoutFailures
        .map((entry) => entry.service)
        .join(', ')}; set the geocoder/routing timeout env vars and redeploy.`,
    )
  }
  if (reasons.length === 0) {
    return null
  }
  return {
    reasons,
    requiredRenderEnv: { ...REQUIRED_RENDER_RUNTIME_ENV },
    steps: [
      'Set the required Render environment variables listed in this report on the parkking service.',
      'If you know the Render service ID, preview with npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>", then set RENDER_API_KEY and apply with npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --execute --deploy. Add --handoff-json .tmp/render-deployment-handoff.json when release package URLs also need to be synced from the local handoff.',
      'If only the Render service name is known, set RENDER_API_KEY and use npm run ops:render-runtime-env-sync -- --service-name parkking --execute --deploy so the service ID can be resolved through the Render API.',
      'Alternatively, run GitHub Actions -> Render Runtime Env Sync after configuring the repository RENDER_API_KEY secret, or dispatch it with npm run ops:render-runtime-env-sync-dispatch -- --repo <owner/repo> --ref main --execute.',
      'Redeploy the Render service after saving the environment changes.',
      'Rerun the verification command and require PASS before treating production as hardened.',
    ],
    verifyCommand: buildRenderDeploymentVerifyCommand(params),
  }
}

const buildReleasePackageRemediation = (params: {
  appUrl: string
  contract: ExpectedDatasetContract
  allParkingAnswerCases: boolean
  districts: RenderDeploymentVerifyDistrict[]
  unexpectedDistricts: string[]
}): RenderDeploymentVerifyRemediation | null => {
  const failedDistricts = params.districts.filter((district) => !district.pass)
  if (failedDistricts.length === 0 && params.unexpectedDistricts.length === 0) {
    return null
  }

  const reasons = [
    `Live parking-answer dataset identities do not match ${params.contract.contractSource}; Render may be serving fallback public/data/generated, a stale release package, or an old build.`,
    ...(failedDistricts.length > 0
      ? [
          `Mismatched districts: ${failedDistricts
            .map((district) => district.districtId)
            .join(', ')}.`,
        ]
      : []),
    ...(params.unexpectedDistricts.length > 0
      ? [
          `Unexpected live districts: ${params.unexpectedDistricts.join(', ')}.`,
        ]
      : []),
  ]

  return {
    reasons,
    requiredRenderEnv: {
      PARKKING_RELEASE_PACKAGE_URL:
        params.contract.releasePackageUrl ??
        '<release package URL matching this manifest>',
      PARKKING_RELEASE_MANIFEST_URL:
        params.contract.releaseManifestUrl ??
        '<published release manifest URL>',
      PARKKING_RELEASE_REQUIRE_MANIFEST: 'true',
      PARKKING_RELEASE_PACKAGE_OUT_ROOT: 'public/data/generated',
    },
    steps: [
      'Set PARKKING_RELEASE_PACKAGE_URL and PARKKING_RELEASE_MANIFEST_URL on the Render service to the release package that produced this verification contract.',
      'If this checkout has the handoff JSON and you know the Render service ID, preview with npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --handoff-json .tmp/render-deployment-handoff.json, then set RENDER_API_KEY and apply with npm run ops:render-runtime-env-sync -- --service-id "<Render service ID>" --handoff-json .tmp/render-deployment-handoff.json --execute --deploy.',
      'If only the Render service name is known, set RENDER_API_KEY and use npm run ops:render-runtime-env-sync -- --service-name parkking --handoff-json .tmp/render-deployment-handoff.json --execute --deploy so the service ID can be resolved through the Render API.',
      'Redeploy with a full build; the build log must show npm run ops:install-release-package -- --require-manifest completing before npm run build.',
      'If those env vars are already set, trigger a fresh build/deploy instead of only restarting the service so dist/data/generated is rebuilt from the release package.',
      'Rerun the verification command and require district hashes and publication timestamps to match before treating production data as current.',
    ],
    verifyCommand: buildRenderDeploymentVerifyCommand(params),
  }
}

export const verifyRenderDeployment = async (
  options: RenderDeploymentVerifyOptions = {},
): Promise<RenderDeploymentVerifyResult> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const readinessTimeoutMs =
    options.readinessTimeoutMs ?? Math.max(DEFAULT_READINESS_TIMEOUT_MS, timeoutMs)
  const contract = await loadExpectedDatasetContract(options, timeoutMs)
  const appUrl = normalizeRenderAppUrl(options.appUrl ?? process.env.PARKKING_RENDER_APP_URL)
  const readinessUrl = buildRenderReadinessUrl(appUrl)
  const errors: string[] = [...contract.errors]

  let status: number | null = null
  let serviceStatus: string | null = null
  let readinessAttempts = 0
  let actualDistricts: ReturnType<typeof parseReadyDistricts> = []
  try {
    const fetchResult = await fetchJsonWithTransientRetry({
      url: readinessUrl,
      timeoutMs: readinessTimeoutMs,
    })
    readinessAttempts = fetchResult.attempts
    if (fetchResult.error) {
      throw fetchResult.error
    }
    const response = fetchResult.result
    if (!response) {
      throw new Error('Readiness request completed without a response')
    }
    status = response.status
    const payload = toRecord(response.payload)
    serviceStatus = getString(payload, 'status')
    if (status !== 200) {
      errors.push(`/api/parking-answer/ready returned HTTP ${status}`)
    }
    if (serviceStatus !== 'ok') {
      errors.push(
        `/api/parking-answer/ready status is ${serviceStatus ?? 'missing'}, expected ok`,
      )
    }
    actualDistricts = parseReadyDistricts(response.payload)
    if (actualDistricts.length === 0) {
      errors.push('/api/parking-answer/ready did not include district readiness metadata')
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }

  const actualByDistrict = new Map(
    actualDistricts.map((district) => [district.districtId, district]),
  )
  const expectedDistrictIds = new Set(
    contract.expectedDatasets.map((dataset) => dataset.districtId),
  )
  const districts = contract.expectedDatasets.map((expected) => {
    const actual = actualByDistrict.get(expected.districtId) ?? null
    const districtErrors: string[] = []
    if (!actual) {
      districtErrors.push('missing from live readiness response')
    } else {
      if (actual.ready !== true) {
        districtErrors.push(`live readiness is ${String(actual.ready)}`)
      }
      if (actual.datasetHash !== expected.datasetHash) {
        districtErrors.push(
          `datasetHash ${actual.datasetHash ?? 'missing'} does not match expected ${expected.datasetHash}`,
        )
      }
      if (actual.publishedAt !== expected.publishedAt) {
        districtErrors.push(
          `publishedAt ${actual.publishedAt ?? 'missing'} does not match expected ${expected.publishedAt}`,
        )
      }
      if (
        actual.latestDatasetHash !== null &&
        actual.latestDatasetHash !== expected.datasetHash
      ) {
        districtErrors.push(
          `latestDatasetHash ${actual.latestDatasetHash} does not match expected ${expected.datasetHash}`,
        )
      }
      if (
        actual.latestPublishedAt !== null &&
        actual.latestPublishedAt !== expected.publishedAt
      ) {
        districtErrors.push(
          `latestPublishedAt ${actual.latestPublishedAt} does not match expected ${expected.publishedAt}`,
        )
      }
    }
    return {
      districtId: expected.districtId,
      expectedDatasetHash: expected.datasetHash,
      expectedPublishedAt: expected.publishedAt,
      actualDatasetHash: actual?.datasetHash ?? null,
      actualPublishedAt: actual?.publishedAt ?? null,
      latestDatasetHash: actual?.latestDatasetHash ?? null,
      latestPublishedAt: actual?.latestPublishedAt ?? null,
      ready: actual?.ready ?? null,
      pass: districtErrors.length === 0,
      errors: districtErrors,
    }
  })
  const unexpectedDistricts = actualDistricts
    .map((district) => district.districtId)
    .filter((districtId) => !expectedDistrictIds.has(districtId))
    .sort()
  const failedDistricts = districts.filter((district) => !district.pass)
  if (failedDistricts.length > 0) {
    errors.push(
      `parking-answer release dataset mismatch: ${failedDistricts
        .map((district) => `${district.districtId}: ${district.errors.join('; ')}`)
        .join(' | ')}`,
    )
  }
  if (unexpectedDistricts.length > 0) {
    errors.push(`unexpected live districts: ${unexpectedDistricts.join(', ')}`)
  }
  let apiServices: SmokeApiServicesSummary | null = null
  let parkingAnswers: RenderDeploymentVerifyParkingAnswerResult[] | null = null
  let syncCors: RenderDeploymentVerifySyncCorsResult | null = null
  let syncBoundary: RenderDeploymentVerifySyncBoundaryResult | null = null
  const selectedApiServices = options.apiServices ?? undefined
  const syncSelected = selectedApiServices?.includes('sync') ?? true
  const parkingAnswerSelected =
    selectedApiServices?.includes('parking-answer') ?? true
  let proxyRuntime: RenderDeploymentVerifyProxyRuntimeResult[] | null = null
  if (!options.skipApiServices) {
    try {
      const shouldRunSyncIssueRoundtrip =
        (options.syncIssueRoundtrip ?? true) &&
        syncSelected
      apiServices = await runSmokeApiServices({
        baseUrl: appUrl,
        services: selectedApiServices,
        timeoutMs,
        syncIssueRoundtrip: shouldRunSyncIssueRoundtrip,
      })
      if (apiServices.failed > 0) {
        const total = apiServices.results.length + apiServices.actions.length
        errors.push(`mounted API service smoke failed (${apiServices.failed}/${total})`)
      }
    } catch (error) {
      errors.push(
        `mounted API service smoke failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if ((options.syncCorsCheck ?? true) && syncSelected) {
      syncCors = await verifyRenderSyncCors({ appUrl, timeoutMs })
      if (!syncCors.pass) {
        errors.push(
          `sync CORS smoke failed: ${syncCors.errors.join('; ')}`,
        )
      }
    }
    if (syncSelected) {
      syncBoundary = await verifyRenderSyncBoundary({ appUrl, timeoutMs })
      if (!syncBoundary.pass) {
        errors.push(
          `sync production boundary failed: ${syncBoundary.errors.join('; ')}`,
        )
      }
    }
    if (
      !options.skipParkingAnswerCases &&
      options.answerCasesDir &&
      parkingAnswerSelected
    ) {
      parkingAnswers = await verifyRenderParkingAnswers({
        appUrl,
        timeoutMs,
        answerCasesDir: options.answerCasesDir,
        expectedDatasets: contract.expectedDatasets,
        allCases: options.allParkingAnswerCases ?? false,
      })
      const failures = parkingAnswers.filter((result) => !result.pass)
      if (failures.length > 0) {
        errors.push(
          `reviewed live parking answers failed: ${failures
            .map(
              (result) =>
                `${result.districtId}/${result.id}: ${result.errors.join('; ')}`,
            )
            .join(' | ')}`,
        )
      }
    }
    const proxyRuntimeServices = (['geocode', 'routing'] as const).filter(
      (service) => selectedApiServices?.includes(service) ?? true,
    )
    if (proxyRuntimeServices.length > 0) {
      proxyRuntime = await verifyRenderProxyRuntimeConfig({
        appUrl,
        timeoutMs,
        services: proxyRuntimeServices,
      })
      const failures = proxyRuntime.filter((result) => !result.pass)
      if (failures.length > 0) {
        errors.push(
          `proxy runtime config smoke failed: ${failures
            .map((result) => `${result.service}: ${result.errors.join('; ')}`)
            .join(' | ')}`,
        )
      }
    }
  }

  const pass =
    errors.length === 0 &&
    districts.every((district) => district.pass) &&
    (apiServices?.failed ?? 0) === 0 &&
    (parkingAnswers?.every((result) => result.pass) ?? true) &&
    (syncCors?.pass ?? true) &&
    (syncBoundary?.pass ?? true) &&
    (proxyRuntime?.every((result) => result.pass) ?? true)
  const remediation = buildRuntimeRemediation({
    appUrl,
    contract,
    allParkingAnswerCases: options.allParkingAnswerCases ?? false,
    syncCors,
    syncBoundary,
    proxyRuntime,
  })
  const releasePackageRemediation = buildReleasePackageRemediation({
    appUrl,
    contract,
    allParkingAnswerCases: options.allParkingAnswerCases ?? false,
    districts,
    unexpectedDistricts,
  })

  return {
    pass,
    appUrl,
    readinessUrl,
    contractSource: contract.contractSource,
    releaseId: contract.releaseId,
    releaseTag: contract.releaseTag,
    status,
    serviceStatus,
    readinessTimeoutMs,
    readinessAttempts,
    expectedDatasets: contract.expectedDatasets,
    districts,
    unexpectedDistricts,
    apiServices,
    parkingAnswers,
    syncCors,
    syncBoundary,
    proxyRuntime,
    releasePackageRemediation,
    remediation,
    errors,
  }
}

const shortHash = (value: string | null) => value?.slice(0, 12) ?? '-'

export const renderRenderDeploymentVerify = (
  result: RenderDeploymentVerifyResult,
) => {
  const lines = [
    `# Render Deployment Verify: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- App URL: ${result.appUrl}`,
    `- Readiness URL: ${result.readinessUrl}`,
    `- Contract source: ${result.contractSource}`,
    `- Release ID: ${result.releaseId ?? '-'}`,
    `- Release tag: ${result.releaseTag ?? '-'}`,
    `- HTTP status: ${result.status ?? '-'}`,
    `- Service status: ${result.serviceStatus ?? '-'}`,
    `- Readiness timeout per attempt: ${result.readinessTimeoutMs}ms`,
    `- Readiness attempts: ${result.readinessAttempts}`,
    `- Unexpected live districts: ${result.unexpectedDistricts.join(', ') || '-'}`,
    '',
    '| Status | District | Expected hash | Actual hash | Expected published | Actual published | Latest published | Ready | Error |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...result.districts.map(
      (district) =>
        `| ${district.pass ? 'PASS' : 'FAIL'} | ${district.districtId} | ${shortHash(district.expectedDatasetHash)} | ${shortHash(district.actualDatasetHash)} | ${district.expectedPublishedAt} | ${district.actualPublishedAt ?? '-'} | ${district.latestPublishedAt ?? '-'} | ${String(district.ready)} | ${district.errors.join('; ')} |`,
    ),
    ...(result.apiServices
      ? [
          '',
          '## Mounted API Services',
          '',
          renderSmokeApiServicesSummary(result.apiServices),
        ]
      : []),
    ...(result.parkingAnswers
      ? [
          '',
          '## Reviewed Live Parking Answers',
          '',
          `- Cases: ${result.parkingAnswers.length}; passed=${result.parkingAnswers.filter((entry) => entry.pass).length}; failed=${result.parkingAnswers.filter((entry) => !entry.pass).length}`,
          '',
          '| Status | District | Coverage area | Case | HTTP | Answer | Evidence | Primary | Dataset hash | Attempts | Elapsed | Error |',
          '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
          ...result.parkingAnswers.map(
            (entry) =>
              `| ${entry.pass ? 'PASS' : 'FAIL'} | ${entry.districtId} | ${entry.coverageAreaId ?? '-'} | ${entry.id} | ${entry.status} | ${entry.answerKind ?? '-'} | ${entry.evidenceKind ?? '-'} | ${entry.primarySegmentId ?? '-'} | ${shortHash(entry.datasetHash)} | ${entry.attempts} | ${entry.elapsedMs}ms | ${entry.errors.join('; ')} |`,
          ),
        ]
      : []),
    ...(result.syncCors
      ? [
          '',
          '## Sync CORS',
          '',
          `- Status: ${result.syncCors.pass ? 'PASS' : 'FAIL'}`,
          `- URL: ${result.syncCors.url}`,
          `- Untrusted origin: ${result.syncCors.untrustedOrigin}`,
          `- HTTP status: ${result.syncCors.status}`,
          `- Access-Control-Allow-Origin: ${result.syncCors.allowOrigin ?? '-'}`,
          `- Errors: ${result.syncCors.errors.join('; ') || 'none'}`,
        ]
      : []),
    ...(result.syncBoundary
      ? [
          '',
          '## Sync Production Boundary',
          '',
          `- Status: ${result.syncBoundary.pass ? 'PASS' : 'FAIL'}`,
          `- Health URL: ${result.syncBoundary.healthUrl}`,
          `- Mode: ${result.syncBoundary.mode ?? '-'}`,
          `- Durability: ${result.syncBoundary.durability ?? '-'}`,
          `- Capabilities: ${result.syncBoundary.capabilities ? JSON.stringify(result.syncBoundary.capabilities) : '-'}`,
          `- Protected reads: ${result.syncBoundary.protectedResources.map((entry) => `${entry.resource}=${entry.status}`).join(', ')}`,
          `- Errors: ${result.syncBoundary.errors.join('; ') || 'none'}`,
        ]
      : []),
    ...(result.proxyRuntime && result.proxyRuntime.length > 0
      ? [
          '',
          '## Proxy Runtime Config',
          '',
          '| Status | Service | URL | HTTP | Service status | Request timeout | Error |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          ...result.proxyRuntime.map(
            (entry) =>
              `| ${entry.pass ? 'PASS' : 'FAIL'} | ${entry.service} | ${entry.url} | ${entry.status} | ${entry.serviceStatus ?? '-'} | ${entry.requestTimeoutMs ?? '-'} | ${entry.errors.join('; ')} |`,
          ),
        ]
      : []),
    ...(result.releasePackageRemediation
      ? [
          '',
          '## Release Package Remediation',
          '',
          'Reasons:',
          ...result.releasePackageRemediation.reasons.map((reason) => `- ${reason}`),
          '',
          'Required Render environment:',
          '',
          '```text',
          ...renderEnvAssignments(result.releasePackageRemediation.requiredRenderEnv),
          '```',
          '',
          'Steps:',
          ...result.releasePackageRemediation.steps.map(
            (step, index) => `${index + 1}. ${step}`,
          ),
          '',
          'Verification:',
          '',
          '```powershell',
          result.releasePackageRemediation.verifyCommand,
          '```',
        ]
      : []),
    ...(result.remediation
      ? [
          '',
          '## Runtime Remediation',
          '',
          'Reasons:',
          ...result.remediation.reasons.map((reason) => `- ${reason}`),
          '',
          'Required Render environment:',
          '',
          '```text',
          ...renderEnvAssignments(result.remediation.requiredRenderEnv),
          '```',
          '',
          'Steps:',
          ...result.remediation.steps.map((step, index) => `${index + 1}. ${step}`),
          '',
          'Verification:',
          '',
          '```powershell',
          result.remediation.verifyCommand,
          '```',
        ]
      : []),
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
  ]
  return `${lines.join('\n')}\n`
}

export const writeRenderDeploymentVerifyOutputs = async (
  result: RenderDeploymentVerifyResult,
  options: Pick<RenderDeploymentVerifyOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, renderRenderDeploymentVerify(result), 'utf-8')
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const options = parseRenderDeploymentVerifyArgs(process.argv)
  const result = await verifyRenderDeployment(options)
  await writeRenderDeploymentVerifyOutputs(result, options)
  console.log(renderRenderDeploymentVerify(result))
  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
