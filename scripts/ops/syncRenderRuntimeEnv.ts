import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildRenderDeploymentEnv,
  REQUIRED_RENDER_RUNTIME_ENV,
  renderEnvAssignments,
} from './renderDeploymentEnv'

const DEFAULT_RENDER_API_URL = 'https://api.render.com/v1'
const DEFAULT_TOKEN_ENV = 'RENDER_API_KEY'
const FALLBACK_TOKEN_ENV = 'RENDER_TOKEN'
const USER_AGENT = 'ParkKing render runtime env sync'

type FetchImpl = typeof fetch

export type RenderDeployMode = 'build_and_deploy' | 'deploy_only'

export interface RenderRuntimeEnvSyncOptions {
  serviceId: string | null
  serviceName: string | null
  apiBaseUrl: string
  execute: boolean
  deploy: boolean
  deployMode: RenderDeployMode
  tokenEnv: string
  token: string | null
  handoffJsonPath: string | null
  packageUrl: string | null
  manifestUrl: string | null
  outPath: string | null
  jsonOutPath: string | null
}

export interface RenderRuntimeEnvUpdateResult {
  key: string
  value: string
  url: string
  executed: boolean
  status: number | null
  pass: boolean
  error: string | null
}

export interface RenderRuntimeDeployResult {
  url: string
  executed: boolean
  deployMode: RenderDeployMode
  status: number | null
  pass: boolean
  error: string | null
}

export interface RenderRuntimeEnvSyncResult {
  pass: boolean
  serviceId: string | null
  serviceName: string | null
  execute: boolean
  deploy: boolean
  tokenEnv: string
  tokenPresent: boolean
  envSource: 'runtime' | 'handoff' | 'urls'
  releasePackageUrl: string | null
  releaseManifestUrl: string | null
  requiredEnv: Record<string, string>
  updates: RenderRuntimeEnvUpdateResult[]
  deployResult: RenderRuntimeDeployResult | null
  errors: string[]
}

interface RenderServiceSummary {
  id: string
  name: string
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

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getString = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'string' ? record[key] : null

const normalizeOptionalString = (value: string | null | undefined) =>
  value?.trim() || null

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalized = normalizeOptionalString(value)
    if (normalized) {
      return normalized
    }
  }
  return null
}

const normalizeApiBaseUrl = (value: string | null | undefined) => {
  const raw = value?.trim() || DEFAULT_RENDER_API_URL
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Render API URL must be http(s): ${raw}`)
  }
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/+$/g, '')
}

const parseDeployMode = (value: string | null): RenderDeployMode => {
  if (value === null) {
    return 'build_and_deploy'
  }
  if (value === 'build_and_deploy' || value === 'deploy_only') {
    return value
  }
  throw new Error('--deploy-mode must be build_and_deploy or deploy_only')
}

const resolveToken = (env: NodeJS.ProcessEnv, tokenEnv: string) =>
  env[tokenEnv]?.trim() || (tokenEnv === DEFAULT_TOKEN_ENV ? env[FALLBACK_TOKEN_ENV]?.trim() : '') || null

const validateHttpUrl = (value: string, label: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} must be http(s): ${value}`)
  }
}

export const parseRenderRuntimeEnvSyncArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): RenderRuntimeEnvSyncOptions => {
  const serviceId =
    getArgValue(argv, '--service-id', '--serviceId') ??
    env.PARKKING_RENDER_SERVICE_ID ??
    env.RENDER_SERVICE_ID ??
    null
  const serviceName =
    getArgValue(argv, '--service-name', '--serviceName') ??
    env.PARKKING_RENDER_SERVICE_NAME ??
    env.RENDER_SERVICE_NAME ??
    null
  if (!serviceId?.trim() && !serviceName?.trim()) {
    throw new Error(
      'Missing Render service id or name. Pass --service-id, --service-name, PARKKING_RENDER_SERVICE_ID, or PARKKING_RENDER_SERVICE_NAME.',
    )
  }
  const tokenEnv = getArgValue(argv, '--token-env', '--tokenEnv') ?? DEFAULT_TOKEN_ENV
  return {
    serviceId: serviceId?.trim() || null,
    serviceName: serviceName?.trim() || null,
    apiBaseUrl: normalizeApiBaseUrl(getArgValue(argv, '--api-url', '--apiUrl')),
    execute: hasFlag(argv, '--execute'),
    deploy: hasFlag(argv, '--deploy'),
    deployMode: parseDeployMode(getArgValue(argv, '--deploy-mode', '--deployMode')),
    tokenEnv,
    token: resolveToken(env, tokenEnv),
    handoffJsonPath: normalizeOptionalString(
      getArgValue(argv, '--handoff-json', '--handoffJson'),
    ),
    packageUrl: firstNonEmpty(
      getArgValue(argv, '--package-url', '--packageUrl'),
      env.PARKKING_RELEASE_PACKAGE_URL,
    ),
    manifestUrl: firstNonEmpty(
      getArgValue(argv, '--manifest-url', '--manifestUrl'),
      env.PARKKING_RELEASE_MANIFEST_URL,
    ),
    outPath: getArgValue(argv, '--out'),
    jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
  }
}

const readHandoffReleaseUrls = async (handoffJsonPath: string) => {
  const parsed = toRecord(
    JSON.parse(await fs.readFile(handoffJsonPath, 'utf-8')) as unknown,
  )
  return {
    packageUrl: getString(parsed, 'packageUrl'),
    manifestUrl: getString(parsed, 'manifestUrl'),
  }
}

const resolveRequiredRenderEnv = async (options: RenderRuntimeEnvSyncOptions) => {
  let packageUrl = options.packageUrl
  let manifestUrl = options.manifestUrl
  let envSource: RenderRuntimeEnvSyncResult['envSource'] = packageUrl || manifestUrl ? 'urls' : 'runtime'
  const errors: string[] = []

  if (options.handoffJsonPath) {
    try {
      const handoff = await readHandoffReleaseUrls(options.handoffJsonPath)
      packageUrl = packageUrl ?? handoff.packageUrl
      manifestUrl = manifestUrl ?? handoff.manifestUrl
      envSource = packageUrl || manifestUrl ? 'handoff' : 'runtime'
    } catch (error) {
      errors.push(
        `Could not read release URLs from ${options.handoffJsonPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  if ((packageUrl && !manifestUrl) || (!packageUrl && manifestUrl)) {
    errors.push(
      'Both release package and manifest URLs are required. Pass --package-url and --manifest-url, or pass --handoff-json with packageUrl and manifestUrl.',
    )
  }

  if (packageUrl) {
    validateHttpUrl(packageUrl, 'package-url')
  }
  if (manifestUrl) {
    validateHttpUrl(manifestUrl, 'manifest-url')
  }

  return {
    envSource,
    packageUrl: packageUrl && manifestUrl ? packageUrl : null,
    manifestUrl: packageUrl && manifestUrl ? manifestUrl : null,
    requiredEnv:
      packageUrl && manifestUrl
        ? buildRenderDeploymentEnv({ packageUrl, manifestUrl })
        : { ...REQUIRED_RENDER_RUNTIME_ENV },
    errors,
  }
}

const buildEnvUpdateUrl = (options: RenderRuntimeEnvSyncOptions, key: string) =>
  `${options.apiBaseUrl}/services/${encodeURIComponent(
    options.serviceId ?? '',
  )}/env-vars/${encodeURIComponent(key)}`

const buildDeployUrl = (options: RenderRuntimeEnvSyncOptions) =>
  `${options.apiBaseUrl}/services/${encodeURIComponent(options.serviceId ?? '')}/deploys`

const buildListServicesUrl = (options: RenderRuntimeEnvSyncOptions) =>
  `${options.apiBaseUrl}/services?limit=100`

const renderApiHeaders = (token: string) => ({
  accept: 'application/json',
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'user-agent': USER_AGENT,
})

const readResponseError = async (response: Response) => {
  const text = await response.text().catch(() => '')
  return text.trim() || `HTTP ${response.status}`
}

const extractRenderServices = (payload: unknown): RenderServiceSummary[] => {
  const entries = Array.isArray(payload) ? payload : []
  return entries
    .map((entry) => {
      const record = toRecord(entry)
      const service = toRecord(record?.service) ?? record
      const id = getString(service, 'id')
      const name = getString(service, 'name')
      return id && name ? { id, name } : null
    })
    .filter((service): service is RenderServiceSummary => service !== null)
}

const resolveRenderServiceId = async (
  options: RenderRuntimeEnvSyncOptions,
  fetchImpl: FetchImpl,
) => {
  if (options.serviceId) {
    return { serviceId: options.serviceId, errors: [] as string[] }
  }
  if (!options.serviceName) {
    return {
      serviceId: null,
      errors: ['Missing Render service id or service name'],
    }
  }
  if (!options.token) {
    return {
      serviceId: null,
      errors: [`Missing ${options.tokenEnv} to resolve Render service name ${options.serviceName}`],
    }
  }

  const response = await fetchImpl(buildListServicesUrl(options), {
    method: 'GET',
    headers: renderApiHeaders(options.token),
  })
  if (!response.ok) {
    return {
      serviceId: null,
      errors: [`Could not list Render services: ${await readResponseError(response)}`],
    }
  }
  const services = extractRenderServices(await response.json())
  const matches = services.filter((service) => service.name === options.serviceName)
  if (matches.length === 0) {
    return {
      serviceId: null,
      errors: [`No Render service named ${options.serviceName} was found`],
    }
  }
  if (matches.length > 1) {
    return {
      serviceId: null,
      errors: [
        `Multiple Render services named ${options.serviceName} were found: ${matches
          .map((service) => service.id)
          .join(', ')}`,
      ],
    }
  }
  return { serviceId: matches[0]?.id ?? null, errors: [] as string[] }
}

const updateEnvVar = async (
  options: RenderRuntimeEnvSyncOptions,
  key: string,
  value: string,
  fetchImpl: FetchImpl,
): Promise<RenderRuntimeEnvUpdateResult> => {
  const url = buildEnvUpdateUrl(options, key)
  if (!options.execute) {
    return {
      key,
      value,
      url,
      executed: false,
      status: null,
      pass: true,
      error: null,
    }
  }
  if (!options.token) {
    return {
      key,
      value,
      url,
      executed: false,
      status: null,
      pass: false,
      error: `Missing ${options.tokenEnv}`,
    }
  }
  try {
    const response = await fetchImpl(url, {
      method: 'PUT',
      headers: renderApiHeaders(options.token),
      body: JSON.stringify({ value }),
    })
    const error = response.ok ? null : await readResponseError(response)
    return {
      key,
      value,
      url,
      executed: true,
      status: response.status,
      pass: response.ok,
      error,
    }
  } catch (error) {
    return {
      key,
      value,
      url,
      executed: true,
      status: null,
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const triggerDeploy = async (
  options: RenderRuntimeEnvSyncOptions,
  fetchImpl: FetchImpl,
): Promise<RenderRuntimeDeployResult | null> => {
  if (!options.deploy) {
    return null
  }
  const url = buildDeployUrl(options)
  if (!options.execute) {
    return {
      url,
      executed: false,
      deployMode: options.deployMode,
      status: null,
      pass: true,
      error: null,
    }
  }
  if (!options.token) {
    return {
      url,
      executed: false,
      deployMode: options.deployMode,
      status: null,
      pass: false,
      error: `Missing ${options.tokenEnv}`,
    }
  }
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: renderApiHeaders(options.token),
      body: JSON.stringify({ deployMode: options.deployMode }),
    })
    const error = response.ok ? null : await readResponseError(response)
    return {
      url,
      executed: true,
      deployMode: options.deployMode,
      status: response.status,
      pass: response.ok,
      error,
    }
  } catch (error) {
    return {
      url,
      executed: true,
      deployMode: options.deployMode,
      status: null,
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export const syncRenderRuntimeEnv = async (
  options: RenderRuntimeEnvSyncOptions,
  fetchImpl: FetchImpl = fetch,
): Promise<RenderRuntimeEnvSyncResult> => {
  const envPlan = await resolveRequiredRenderEnv(options)
  const resolved = await resolveRenderServiceId(options, fetchImpl)
  const resolvedOptions = {
    ...options,
    serviceId: resolved.serviceId,
  }
  const updates: RenderRuntimeEnvUpdateResult[] = []
  if (envPlan.errors.length === 0 && resolved.errors.length === 0) {
    for (const [key, value] of Object.entries(envPlan.requiredEnv)) {
      updates.push(await updateEnvVar(resolvedOptions, key, value, fetchImpl))
    }
  }

  const updateErrors = updates
    .filter((update) => !update.pass)
    .map((update) => `${update.key}: ${update.error ?? 'failed'}`)
  const deployResult =
    resolved.errors.length === 0 && updateErrors.length === 0
      ? await triggerDeploy(resolvedOptions, fetchImpl)
      : null
  const errors = [
    ...envPlan.errors,
    ...resolved.errors,
    ...updateErrors,
    ...(deployResult && !deployResult.pass
      ? [`deploy: ${deployResult.error ?? 'failed'}`]
      : []),
  ]

  return {
    pass: errors.length === 0,
    serviceId: resolved.serviceId,
    serviceName: options.serviceName,
    execute: options.execute,
    deploy: options.deploy,
    tokenEnv: options.tokenEnv,
    tokenPresent: Boolean(options.token),
    envSource: envPlan.envSource,
    releasePackageUrl: envPlan.packageUrl,
    releaseManifestUrl: envPlan.manifestUrl,
    requiredEnv: envPlan.requiredEnv,
    updates,
    deployResult,
    errors,
  }
}

const renderManualDashboardFallback = (result: RenderRuntimeEnvSyncResult) => {
  if (result.pass) {
    return []
  }

  return [
    '',
    '## Manual Dashboard Fallback',
    '',
    '- Open Render Dashboard -> parkking service -> Environment.',
    '- Add or update every key under Required Render Environment with the exact value shown.',
    '- Save changes and trigger Manual Deploy -> Deploy latest commit.',
    '- After deploy completes, rerun production rollout status with --check-live.',
  ]
}

export const renderRenderRuntimeEnvSyncResult = (
  result: RenderRuntimeEnvSyncResult,
) => [
  `# Render Runtime Env Sync: ${result.pass ? 'PASS' : 'FAIL'}`,
  '',
  `- Service ID: ${result.serviceId ?? '-'}`,
  `- Service name: ${result.serviceName ?? '-'}`,
  `- Mode: ${result.execute ? 'execute' : 'dry-run'}`,
  `- Deploy after env sync: ${result.deploy}`,
  `- Token env: ${result.tokenEnv}`,
  `- Token present: ${result.tokenPresent}`,
  `- Env source: ${result.envSource}`,
  `- Release package URL: ${result.releasePackageUrl ?? '-'}`,
  `- Release manifest URL: ${result.releaseManifestUrl ?? '-'}`,
  '',
  '## Required Render Environment',
  '',
  '```text',
  ...renderEnvAssignments(result.requiredEnv),
  '```',
  '',
  '## Env Var Updates',
  '',
  '| Status | Key | Executed | HTTP | Endpoint | Error |',
  '| --- | --- | --- | --- | --- | --- |',
  ...result.updates.map(
    (update) =>
      `| ${update.pass ? 'PASS' : 'FAIL'} | ${update.key} | ${update.executed} | ${update.status ?? '-'} | ${update.url} | ${update.error ?? ''} |`,
  ),
  ...(result.deployResult
    ? [
        '',
        '## Deploy',
        '',
        `- Status: ${result.deployResult.pass ? 'PASS' : 'FAIL'}`,
        `- Executed: ${result.deployResult.executed}`,
        `- Deploy mode: ${result.deployResult.deployMode}`,
        `- HTTP: ${result.deployResult.status ?? '-'}`,
        `- Endpoint: ${result.deployResult.url}`,
        `- Error: ${result.deployResult.error ?? 'none'}`,
      ]
    : []),
  ...renderManualDashboardFallback(result),
  '',
  '## Errors',
  '',
  ...(result.errors.length > 0
    ? result.errors.map((error) => `- ${error}`)
    : ['- none']),
  '',
].join('\n')

export const writeRenderRuntimeEnvSyncOutputs = async (
  result: RenderRuntimeEnvSyncResult,
  options: Pick<RenderRuntimeEnvSyncOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, renderRenderRuntimeEnvSyncResult(result), 'utf-8')
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const argv = process.argv.slice(2)
  if (hasFlag(argv, '--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/syncRenderRuntimeEnv.ts (--service-id <id> | --service-name <name>) [options]',
        '',
        'Options:',
        '  --service-id <id>               Defaults to PARKKING_RENDER_SERVICE_ID or RENDER_SERVICE_ID',
        '  --service-name <name>           Resolve service id from Render API; defaults to PARKKING_RENDER_SERVICE_NAME or RENDER_SERVICE_NAME',
        '  --api-url <url>                 Defaults to https://api.render.com/v1',
        '  --handoff-json <path>           Reads packageUrl and manifestUrl from a render deployment handoff',
        '  --package-url <url>             Release package URL to sync alongside runtime env',
        '  --manifest-url <url>            Release manifest URL to sync alongside runtime env',
        '  --execute                       Actually update Render env vars; default is dry-run',
        '  --deploy                        Trigger a deploy after successful env updates',
        '  --deploy-mode <mode>            build_and_deploy or deploy_only; defaults to build_and_deploy',
        '  --token-env <name>              Defaults to RENDER_API_KEY, with RENDER_TOKEN fallback',
        '  --out <path>                    Optional markdown report path',
        '  --json-out <path>               Optional JSON report path',
      ].join('\n'),
    )
    return
  }
  const options = parseRenderRuntimeEnvSyncArgs(argv)
  const result = await syncRenderRuntimeEnv(options)
  await writeRenderRuntimeEnvSyncOutputs(result, options)
  console.log(renderRenderRuntimeEnvSyncResult(result))
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
