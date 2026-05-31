import { spawnSync } from 'node:child_process'

const DEFAULT_TOKEN_ENVS = ['GH_TOKEN', 'GITHUB_TOKEN']

export type WorkflowDispatchInputs = Record<string, string>

export type WorkflowDispatchFetch = (
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

export interface WorkflowDispatchRequest<
  TInputs extends WorkflowDispatchInputs = WorkflowDispatchInputs,
> {
  url: string
  payload: {
    ref: string
    inputs: TInputs
  }
}

export interface WorkflowDispatchOptions<
  TInputs extends WorkflowDispatchInputs = WorkflowDispatchInputs,
> {
  repo: string
  ref: string
  workflow: string
  inputs: TInputs
  dryRun: boolean
  token?: string | null
  userAgent: string
}

export interface WorkflowDispatchResult<
  TInputs extends WorkflowDispatchInputs = WorkflowDispatchInputs,
> {
  dispatched: boolean
  request: WorkflowDispatchRequest<TInputs>
  status: number | null
}

export const getArgValue = (argv: string[], ...flags: string[]) => {
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

export const hasFlag = (argv: string[], flag: string) =>
  argv.includes(flag) || argv.some((arg) => arg.startsWith(`${flag}=`))

export const parseBooleanArg = (
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

export const resolveCurrentGitBranch = () => {
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

export const resolveWorkflowDispatchToken = (argv: string[]) => {
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

export const normalizeGithubRepository = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  return /^[^/\s]+\/[^/\s]+$/.test(trimmed) ? trimmed : null
}

export const validateHttpUrl = (value: string, label: string) => {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('unsupported protocol')
    }
  } catch {
    throw new Error(`${label} must be an http(s) URL`)
  }
}

export const buildWorkflowDispatchRequest = <
  TInputs extends WorkflowDispatchInputs,
>(options: {
  repo: string
  ref: string
  workflow: string
  inputs: TInputs
}): WorkflowDispatchRequest<TInputs> => ({
  url: `https://api.github.com/repos/${options.repo}/actions/workflows/${encodeURIComponent(
    options.workflow,
  )}/dispatches`,
  payload: {
    ref: options.ref,
    inputs: options.inputs,
  },
})

export const dispatchWorkflow = async <
  TInputs extends WorkflowDispatchInputs,
>(
  options: WorkflowDispatchOptions<TInputs>,
  fetchImpl: WorkflowDispatchFetch = fetch,
): Promise<WorkflowDispatchResult<TInputs>> => {
  const request = buildWorkflowDispatchRequest(options)
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
      'user-agent': options.userAgent,
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
