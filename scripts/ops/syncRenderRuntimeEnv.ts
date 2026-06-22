import { fileURLToPath } from 'node:url'
import {
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
  serviceId: string
  apiBaseUrl: string
  execute: boolean
  deploy: boolean
  deployMode: RenderDeployMode
  tokenEnv: string
  token: string | null
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
  serviceId: string
  execute: boolean
  deploy: boolean
  tokenEnv: string
  tokenPresent: boolean
  requiredEnv: Record<string, string>
  updates: RenderRuntimeEnvUpdateResult[]
  deployResult: RenderRuntimeDeployResult | null
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

const hasFlag = (argv: string[], ...flags: string[]) =>
  flags.some((flag) => argv.includes(flag))

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

export const parseRenderRuntimeEnvSyncArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): RenderRuntimeEnvSyncOptions => {
  const serviceId =
    getArgValue(argv, '--service-id', '--serviceId') ??
    env.PARKKING_RENDER_SERVICE_ID ??
    env.RENDER_SERVICE_ID ??
    ''
  if (!serviceId.trim()) {
    throw new Error(
      'Missing Render service id. Pass --service-id or set PARKKING_RENDER_SERVICE_ID.',
    )
  }
  const tokenEnv = getArgValue(argv, '--token-env', '--tokenEnv') ?? DEFAULT_TOKEN_ENV
  return {
    serviceId: serviceId.trim(),
    apiBaseUrl: normalizeApiBaseUrl(getArgValue(argv, '--api-url', '--apiUrl')),
    execute: hasFlag(argv, '--execute'),
    deploy: hasFlag(argv, '--deploy'),
    deployMode: parseDeployMode(getArgValue(argv, '--deploy-mode', '--deployMode')),
    tokenEnv,
    token: resolveToken(env, tokenEnv),
  }
}

const buildEnvUpdateUrl = (options: RenderRuntimeEnvSyncOptions, key: string) =>
  `${options.apiBaseUrl}/services/${encodeURIComponent(
    options.serviceId,
  )}/env-vars/${encodeURIComponent(key)}`

const buildDeployUrl = (options: RenderRuntimeEnvSyncOptions) =>
  `${options.apiBaseUrl}/services/${encodeURIComponent(options.serviceId)}/deploys`

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
  const updates: RenderRuntimeEnvUpdateResult[] = []
  for (const [key, value] of Object.entries(REQUIRED_RENDER_RUNTIME_ENV)) {
    updates.push(await updateEnvVar(options, key, value, fetchImpl))
  }

  const updateErrors = updates
    .filter((update) => !update.pass)
    .map((update) => `${update.key}: ${update.error ?? 'failed'}`)
  const deployResult =
    updateErrors.length === 0 ? await triggerDeploy(options, fetchImpl) : null
  const errors = [
    ...updateErrors,
    ...(deployResult && !deployResult.pass
      ? [`deploy: ${deployResult.error ?? 'failed'}`]
      : []),
  ]

  return {
    pass: errors.length === 0,
    serviceId: options.serviceId,
    execute: options.execute,
    deploy: options.deploy,
    tokenEnv: options.tokenEnv,
    tokenPresent: Boolean(options.token),
    requiredEnv: { ...REQUIRED_RENDER_RUNTIME_ENV },
    updates,
    deployResult,
    errors,
  }
}

export const renderRenderRuntimeEnvSyncResult = (
  result: RenderRuntimeEnvSyncResult,
) => [
  `# Render Runtime Env Sync: ${result.pass ? 'PASS' : 'FAIL'}`,
  '',
  `- Service ID: ${result.serviceId}`,
  `- Mode: ${result.execute ? 'execute' : 'dry-run'}`,
  `- Deploy after env sync: ${result.deploy}`,
  `- Token env: ${result.tokenEnv}`,
  `- Token present: ${result.tokenPresent}`,
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
  '',
  '## Errors',
  '',
  ...(result.errors.length > 0
    ? result.errors.map((error) => `- ${error}`)
    : ['- none']),
  '',
].join('\n')

const run = async () => {
  const argv = process.argv.slice(2)
  if (hasFlag(argv, '--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/syncRenderRuntimeEnv.ts --service-id <Render service id> [options]',
        '',
        'Options:',
        '  --service-id <id>               Defaults to PARKKING_RENDER_SERVICE_ID or RENDER_SERVICE_ID',
        '  --api-url <url>                 Defaults to https://api.render.com/v1',
        '  --execute                       Actually update Render env vars; default is dry-run',
        '  --deploy                        Trigger a deploy after successful env updates',
        '  --deploy-mode <mode>            build_and_deploy or deploy_only; defaults to build_and_deploy',
        '  --token-env <name>              Defaults to RENDER_API_KEY, with RENDER_TOKEN fallback',
      ].join('\n'),
    )
    return
  }
  const options = parseRenderRuntimeEnvSyncArgs(argv)
  const result = await syncRenderRuntimeEnv(options)
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
