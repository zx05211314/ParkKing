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

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_TIMEOUT_MS = 15_000

export interface RenderDeploymentVerifyOptions {
  appUrl?: string | null
  handoffJsonPath?: string | null
  manifestPath?: string | null
  manifestUrl?: string | null
  downloadToken?: string | null
  downloadAuthHeader?: string | null
  timeoutMs?: number | null
  skipApiServices?: boolean | null
  apiServices?: SmokeApiServiceId[] | null
  syncIssueRoundtrip?: boolean | null
  syncCorsCheck?: boolean | null
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface RenderDeploymentVerifyDistrict {
  districtId: string
  expectedDatasetHash: string
  actualDatasetHash: string | null
  latestDatasetHash: string | null
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
  expectedDatasets: RenderDeploymentHandoffDataset[]
  districts: RenderDeploymentVerifyDistrict[]
  unexpectedDistricts: string[]
  apiServices?: SmokeApiServicesSummary | null
  syncCors?: RenderDeploymentVerifySyncCorsResult | null
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

interface FetchJsonResult {
  status: number
  payload: unknown
}

interface ExpectedDatasetContract {
  contractSource: string
  releaseId: string | null
  releaseTag: string | null
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
): RenderDeploymentVerifyOptions => ({
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
  timeoutMs:
    parsePositiveInteger(
      getArgValue(argv, '--timeout-ms', '--timeoutMs'),
      'timeout-ms',
    ) ?? DEFAULT_TIMEOUT_MS,
  skipApiServices: hasFlag(argv, '--skip-api-services', '--skipApiServices'),
  apiServices: parseApiServices(getArgValue(argv, '--api-services', '--apiServices')),
  syncIssueRoundtrip:
    !hasFlag(argv, '--skip-sync-issue-roundtrip', '--skipSyncIssueRoundtrip'),
  syncCorsCheck: !hasFlag(argv, '--skip-sync-cors-check', '--skipSyncCorsCheck'),
  outPath: getArgValue(argv, '--out'),
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
})

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
      return districtId && datasetHash ? { districtId, datasetHash } : null
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
      return districtId && datasetHash ? { districtId, datasetHash } : null
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
    return {
      contractSource: source,
      releaseId: getString(parsed, 'releaseId'),
      releaseTag: null,
      expectedDatasets,
      errors:
        expectedDatasets.length > 0
          ? []
          : [`${source} has no districts dataset contract`],
    }
  }

  const handoffJsonPath = explicitHandoffJsonPath || DEFAULT_HANDOFF_JSON
  const handoff = await readJsonFile<Record<string, unknown>>(handoffJsonPath)
  const release = toRecord(handoff.release)
  const expectedDatasets = getExpectedDatasets(handoff)
  return {
    contractSource: handoffJsonPath,
    releaseId: getString(release, 'releaseId'),
    releaseTag: getString(release, 'tag'),
    expectedDatasets,
    errors: [
      ...(handoff.ready === true ? [] : [`${handoffJsonPath} is not marked ready`]),
      ...(expectedDatasets.length > 0
        ? []
        : [`${handoffJsonPath} has no expectedDatasets contract`]),
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
            latestDatasetHash: getString(entry, 'latestDatasetHash'),
            ready: getBoolean(entry, 'ready'),
          }
        : null
    })
    .filter((entry): entry is {
      districtId: string
      datasetHash: string | null
      latestDatasetHash: string | null
      ready: boolean | null
    } => entry !== null)
}

export const buildRenderReadinessUrl = (appUrl: string) =>
  new URL('/api/parking-answer/ready', `${appUrl}/`).toString()

export const buildRenderSyncIssuesUrl = (appUrl: string) =>
  new URL('/api/sync/issues', `${appUrl}/`).toString()

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

export const verifyRenderDeployment = async (
  options: RenderDeploymentVerifyOptions = {},
): Promise<RenderDeploymentVerifyResult> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const contract = await loadExpectedDatasetContract(options, timeoutMs)
  const appUrl = normalizeRenderAppUrl(options.appUrl ?? process.env.PARKKING_RENDER_APP_URL)
  const readinessUrl = buildRenderReadinessUrl(appUrl)
  const errors: string[] = [...contract.errors]

  let status: number | null = null
  let serviceStatus: string | null = null
  let actualDistricts: ReturnType<typeof parseReadyDistricts> = []
  try {
    const response = await fetchJsonWithTimeout(readinessUrl, timeoutMs)
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
      if (
        actual.latestDatasetHash !== null &&
        actual.latestDatasetHash !== expected.datasetHash
      ) {
        districtErrors.push(
          `latestDatasetHash ${actual.latestDatasetHash} does not match expected ${expected.datasetHash}`,
        )
      }
    }
    return {
      districtId: expected.districtId,
      expectedDatasetHash: expected.datasetHash,
      actualDatasetHash: actual?.datasetHash ?? null,
      latestDatasetHash: actual?.latestDatasetHash ?? null,
      ready: actual?.ready ?? null,
      pass: districtErrors.length === 0,
      errors: districtErrors,
    }
  })
  const unexpectedDistricts = actualDistricts
    .map((district) => district.districtId)
    .filter((districtId) => !expectedDistrictIds.has(districtId))
    .sort()
  let apiServices: SmokeApiServicesSummary | null = null
  let syncCors: RenderDeploymentVerifySyncCorsResult | null = null
  const selectedApiServices = options.apiServices ?? undefined
  const syncSelected = selectedApiServices?.includes('sync') ?? true
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
  }

  return {
    pass:
      errors.length === 0 &&
      districts.every((district) => district.pass) &&
      (apiServices?.failed ?? 0) === 0 &&
      (syncCors?.pass ?? true),
    appUrl,
    readinessUrl,
    contractSource: contract.contractSource,
    releaseId: contract.releaseId,
    releaseTag: contract.releaseTag,
    status,
    serviceStatus,
    expectedDatasets: contract.expectedDatasets,
    districts,
    unexpectedDistricts,
    apiServices,
    syncCors,
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
    `- Unexpected live districts: ${result.unexpectedDistricts.join(', ') || '-'}`,
    '',
    '| Status | District | Expected hash | Actual hash | Latest hash | Ready | Error |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...result.districts.map(
      (district) =>
        `| ${district.pass ? 'PASS' : 'FAIL'} | ${district.districtId} | ${shortHash(district.expectedDatasetHash)} | ${shortHash(district.actualDatasetHash)} | ${shortHash(district.latestDatasetHash)} | ${String(district.ready)} | ${district.errors.join('; ')} |`,
    ),
    ...(result.apiServices
      ? [
          '',
          '## Mounted API Services',
          '',
          renderSmokeApiServicesSummary(result.apiServices),
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
