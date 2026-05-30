import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DEFAULT_WORKFLOW = 'release_data.yml'
const DEFAULT_CONFIGS_GLOB = 'configs/prod/*.json'
const DEFAULT_TOKEN_ENVS = ['GH_TOKEN', 'GITHUB_TOKEN']

type FetchLike = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
  },
) => Promise<{
  ok: boolean
  status: number
  statusText: string
  text: () => Promise<string>
}>

export interface ReleaseDataDispatchOptions {
  repo: string
  ref: string
  workflow: string
  configsGlob: string
  allowWarn: boolean
  overrideReason: string
  tag: string
  latest: boolean
  dryRun: boolean
  token?: string | null
}

export interface ReleaseDataDispatchRequest {
  url: string
  payload: {
    ref: string
    inputs: {
      configsGlob: string
      allowWarn: string
      overrideReason: string
      tag: string
      latest: string
    }
  }
}

export interface ReleaseDataDispatchResult {
  dispatched: boolean
  request: ReleaseDataDispatchRequest
  status: number | null
}

const getArgValue = (argv: string[], flag: string) => {
  const assignmentPrefix = `${flag}=`
  const assigned = argv.find((arg) => arg.startsWith(assignmentPrefix))
  if (assigned) {
    return assigned.slice(assignmentPrefix.length)
  }
  const index = argv.indexOf(flag)
  if (index < 0) {
    return null
  }
  const value = argv[index + 1]
  return value && !value.startsWith('-') ? value : null
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

export const parseReleaseDataDispatchArgs = (
  argv: string[],
): ReleaseDataDispatchOptions => {
  const repo = getArgValue(argv, '--repo') ?? process.env.GITHUB_REPOSITORY
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error('Missing --repo owner/name or GITHUB_REPOSITORY')
  }

  const ref =
    getArgValue(argv, '--ref') ??
    process.env.GITHUB_REF_NAME ??
    resolveCurrentGitBranch()
  if (!ref) {
    throw new Error('Missing --ref and unable to resolve current git branch')
  }

  const allowWarn = parseBooleanArg(argv, '--allow-warn', false)
  const overrideReason = getArgValue(argv, '--override-reason') ?? ''
  if (allowWarn && !overrideReason.trim()) {
    throw new Error('--override-reason is required when --allow-warn is true')
  }

  return {
    repo,
    ref,
    workflow: getArgValue(argv, '--workflow') ?? DEFAULT_WORKFLOW,
    configsGlob: getArgValue(argv, '--configs-glob') ?? DEFAULT_CONFIGS_GLOB,
    allowWarn,
    overrideReason,
    tag: getArgValue(argv, '--tag') ?? '',
    latest: parseBooleanArg(argv, '--latest', false),
    dryRun: hasFlag(argv, '--dry-run'),
    token: resolveToken(argv),
  }
}

export const buildReleaseDataDispatchRequest = (
  options: ReleaseDataDispatchOptions,
): ReleaseDataDispatchRequest => ({
  url: `https://api.github.com/repos/${options.repo}/actions/workflows/${encodeURIComponent(
    options.workflow,
  )}/dispatches`,
  payload: {
    ref: options.ref,
    inputs: {
      configsGlob: options.configsGlob,
      allowWarn: String(options.allowWarn),
      overrideReason: options.overrideReason,
      tag: options.tag,
      latest: String(options.latest),
    },
  },
})

export const renderReleaseDataDispatchPlan = (
  options: ReleaseDataDispatchOptions,
  request = buildReleaseDataDispatchRequest(options),
) => [
  `# Release Data Package Dispatch: ${options.dryRun ? 'DRY RUN' : 'READY'}`,
  '',
  `- Repository: ${options.repo}`,
  `- Ref: ${options.ref}`,
  `- Workflow: ${options.workflow}`,
  `- Configs glob: ${options.configsGlob}`,
  `- Allow warnings: ${options.allowWarn}`,
  `- Override reason: ${options.overrideReason || '(none)'}`,
  `- Tag: ${options.tag || '(workflow default)'}`,
  `- Mark latest: ${options.latest}`,
  `- Endpoint: POST ${request.url}`,
  '',
  '## Payload',
  '',
  '```json',
  JSON.stringify(request.payload, null, 2),
  '```',
  '',
].join('\n')

export const dispatchReleaseDataWorkflow = async (
  options: ReleaseDataDispatchOptions,
  fetchImpl: FetchLike = fetch,
): Promise<ReleaseDataDispatchResult> => {
  const request = buildReleaseDataDispatchRequest(options)
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
      'user-agent': 'ParkKing release data dispatch',
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
        'Usage: tsx scripts/ops/dispatchReleaseDataWorkflow.ts --repo owner/name --ref <branch> [options]',
        '',
        'Options:',
        '  --configs-glob <glob>       Defaults to configs/prod/*.json',
        '  --allow-warn [true|false]   Allows WARN anomalies; requires --override-reason when true',
        '  --override-reason <text>    Human reason for allow-warn release dispatches',
        '  --tag <tag>                 Optional release tag; workflow defaults to data-<release-id>',
        '  --latest [true|false]       Marks the data release as latest',
        '  --workflow <file>           Defaults to release_data.yml',
        '  --token-env <name>          Token env var; defaults to GH_TOKEN then GITHUB_TOKEN',
        '  --dry-run                  Print request without dispatching',
      ].join('\n'),
    )
    return
  }

  const options = parseReleaseDataDispatchArgs(argv)
  console.log(renderReleaseDataDispatchPlan(options))
  const result = await dispatchReleaseDataWorkflow(options)
  if (result.dispatched) {
    console.log(`Release Data Package workflow dispatched: HTTP ${result.status}`)
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
