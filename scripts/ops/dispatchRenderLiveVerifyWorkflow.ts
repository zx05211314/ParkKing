import * as fs from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_WORKFLOW = 'render_live_verify.yml'
const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_TOKEN_ENVS = ['GH_TOKEN', 'GITHUB_TOKEN']

type FetchLike = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
  },
) => Promise<{
  status: number
  statusText: string
  text: () => Promise<string>
}>

interface RenderDeploymentHandoffJson {
  repository?: unknown
  manifestUrl?: unknown
  renderEnv?: {
    PARKKING_RELEASE_MANIFEST_URL?: unknown
  }
}

export interface RenderLiveVerifyDispatchOptions {
  repo: string
  ref: string
  workflow: string
  appUrl: string
  manifestUrl: string
  useGithubToken: boolean
  skipSyncIssueRoundtrip: boolean
  dryRun: boolean
  token?: string | null
}

export interface RenderLiveVerifyDispatchRequest {
  url: string
  payload: {
    ref: string
    inputs: {
      appUrl: string
      manifestUrl: string
      useGithubToken: string
      skipSyncIssueRoundtrip: string
    }
  }
}

export interface RenderLiveVerifyDispatchResult {
  dispatched: boolean
  request: RenderLiveVerifyDispatchRequest
  status: number | null
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const assignmentPrefix = `${flag}=`
    const assigned = argv.find((arg) => arg.startsWith(assignmentPrefix))
    if (assigned) {
      return assigned.slice(assignmentPrefix.length)
    }
    const index = argv.indexOf(flag)
    if (index >= 0) {
      const value = argv[index + 1]
      return value && !value.startsWith('-') ? value : null
    }
  }
  return null
}

const hasFlag = (argv: string[], flag: string) =>
  argv.includes(flag) || argv.some((arg) => arg.startsWith(`${flag}=`))

const parseBooleanArg = (
  argv: string[],
  flag: string,
  defaultValue: boolean,
) => {
  const value = getArgValue(argv, flag)
  if (value === null) {
    return hasFlag(argv, flag) ? true : defaultValue
  }
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  throw new Error(`${flag} must be true or false when a value is provided`)
}

const resolveCurrentGitBranch = () => {
  const result = spawnSync('git', ['branch', '--show-current'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  if (result.status !== 0) {
    return null
  }
  const branch = result.stdout.trim()
  return branch || null
}

const resolveToken = (argv: string[]) => {
  const tokenEnv = getArgValue(argv, '--token-env')
  if (tokenEnv) {
    return process.env[tokenEnv] ?? null
  }
  for (const envName of DEFAULT_TOKEN_ENVS) {
    const value = process.env[envName]
    if (value) {
      return value
    }
  }
  return null
}

const readHandoffJson = async (filePath: string) => {
  try {
    return JSON.parse(
      await fs.readFile(filePath, 'utf-8'),
    ) as RenderDeploymentHandoffJson
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const normalizeRepository = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  return /^[^/\s]+\/[^/\s]+$/.test(trimmed) ? trimmed : null
}

const validateUrl = (value: string, label: string) => {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol')
    }
  } catch {
    throw new Error(`${label} must be an http(s) URL`)
  }
}

export const resolveRenderLiveVerifyDispatchOptions = async (
  argv: string[],
): Promise<RenderLiveVerifyDispatchOptions> => {
  const handoffPath =
    getArgValue(argv, '--handoff-json', '--handoffJson') ?? DEFAULT_HANDOFF_JSON
  const handoff = await readHandoffJson(handoffPath)
  const repo =
    normalizeRepository(getArgValue(argv, '--repo')) ??
    normalizeRepository(process.env.GITHUB_REPOSITORY) ??
    normalizeRepository(
      typeof handoff?.repository === 'string' ? handoff.repository : null,
    )
  if (!repo) {
    throw new Error(
      'Missing --repo owner/name, GITHUB_REPOSITORY, or repository in handoff JSON',
    )
  }

  const ref =
    getArgValue(argv, '--ref') ??
    process.env.GITHUB_REF_NAME ??
    resolveCurrentGitBranch()
  if (!ref) {
    throw new Error('Missing --ref and unable to resolve current git branch')
  }

  const appUrl =
    getArgValue(argv, '--app-url', '--appUrl') ??
    process.env.PARKKING_RENDER_APP_URL
  if (!appUrl) {
    throw new Error('Missing --app-url <Render service URL>')
  }
  validateUrl(appUrl, '--app-url')

  const manifestUrl =
    getArgValue(argv, '--manifest-url', '--manifestUrl') ??
    process.env.PARKKING_RELEASE_MANIFEST_URL ??
    (typeof handoff?.manifestUrl === 'string' ? handoff.manifestUrl : null) ??
    (typeof handoff?.renderEnv?.PARKKING_RELEASE_MANIFEST_URL === 'string'
      ? handoff.renderEnv.PARKKING_RELEASE_MANIFEST_URL
      : null)
  if (!manifestUrl) {
    throw new Error(
      `Missing --manifest-url and no manifestUrl found in ${handoffPath}`,
    )
  }
  validateUrl(manifestUrl, '--manifest-url')

  return {
    repo,
    ref,
    workflow: getArgValue(argv, '--workflow') ?? DEFAULT_WORKFLOW,
    appUrl,
    manifestUrl,
    useGithubToken: parseBooleanArg(argv, '--use-github-token', false),
    skipSyncIssueRoundtrip: parseBooleanArg(
      argv,
      '--skip-sync-issue-roundtrip',
      false,
    ),
    dryRun: hasFlag(argv, '--dry-run'),
    token: resolveToken(argv),
  }
}

export const buildRenderLiveVerifyDispatchRequest = (
  options: RenderLiveVerifyDispatchOptions,
): RenderLiveVerifyDispatchRequest => ({
  url: `https://api.github.com/repos/${options.repo}/actions/workflows/${encodeURIComponent(
    options.workflow,
  )}/dispatches`,
  payload: {
    ref: options.ref,
    inputs: {
      appUrl: options.appUrl,
      manifestUrl: options.manifestUrl,
      useGithubToken: String(options.useGithubToken),
      skipSyncIssueRoundtrip: String(options.skipSyncIssueRoundtrip),
    },
  },
})

export const renderRenderLiveVerifyDispatchPlan = (
  options: RenderLiveVerifyDispatchOptions,
  request = buildRenderLiveVerifyDispatchRequest(options),
) => [
  `# Render Live Verify Dispatch: ${options.dryRun ? 'DRY RUN' : 'READY'}`,
  '',
  `- Repository: ${options.repo}`,
  `- Ref: ${options.ref}`,
  `- Workflow: ${options.workflow}`,
  `- App URL: ${options.appUrl}`,
  `- Manifest URL: ${options.manifestUrl}`,
  `- Use GitHub token for release asset reads: ${options.useGithubToken}`,
  `- Skip sync issue roundtrip: ${options.skipSyncIssueRoundtrip}`,
  `- Endpoint: POST ${request.url}`,
  '',
  '## Payload',
  '',
  '```json',
  JSON.stringify(request.payload, null, 2),
  '```',
  '',
].join('\n')

export const dispatchRenderLiveVerifyWorkflow = async (
  options: RenderLiveVerifyDispatchOptions,
  fetchImpl: FetchLike = fetch,
): Promise<RenderLiveVerifyDispatchResult> => {
  const request = buildRenderLiveVerifyDispatchRequest(options)
  if (options.dryRun) {
    return {
      dispatched: false,
      request,
      status: null,
    }
  }

  if (!options.token) {
    throw new Error('Missing GH_TOKEN or GITHUB_TOKEN; use --dry-run to preview only')
  }

  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${options.token}`,
      'content-type': 'application/json',
      'user-agent': 'ParkKing render live verify dispatch',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(request.payload),
  })

  if (response.status !== 204) {
    const body = await response.text()
    throw new Error(
      `GitHub workflow dispatch failed: HTTP ${response.status} ${
        response.statusText
      }${body ? ` - ${body}` : ''}`,
    )
  }

  return {
    dispatched: true,
    request,
    status: response.status,
  }
}

const run = async () => {
  const argv = process.argv.slice(2)
  if (hasFlag(argv, '--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/dispatchRenderLiveVerifyWorkflow.ts --app-url <Render URL> [options]',
        '',
        'Options:',
        '  --repo <owner/name>                  Defaults to GITHUB_REPOSITORY or handoff JSON repository',
        '  --ref <branch>                      Defaults to GITHUB_REF_NAME or current git branch',
        '  --manifest-url <url>                Defaults to PARKKING_RELEASE_MANIFEST_URL or handoff JSON',
        '  --handoff-json <path>               Defaults to .tmp/render-deployment-handoff.json',
        '  --use-github-token [true|false]     Workflow input for private release assets',
        '  --skip-sync-issue-roundtrip         Workflow input for live environments that reject smoke writes',
        '  --workflow <file>                   Defaults to render_live_verify.yml',
        '  --token-env <name>                  Dispatch token env var; defaults to GH_TOKEN then GITHUB_TOKEN',
        '  --dry-run                           Print request without dispatching',
      ].join('\n'),
    )
    return
  }

  const options = await resolveRenderLiveVerifyDispatchOptions(argv)
  console.log(renderRenderLiveVerifyDispatchPlan(options))
  const result = await dispatchRenderLiveVerifyWorkflow(options)
  if (result.dispatched) {
    console.log(`Render Live Verify workflow dispatched: HTTP ${result.status}`)
  } else {
    console.log('Dry run only; workflow was not dispatched.')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
