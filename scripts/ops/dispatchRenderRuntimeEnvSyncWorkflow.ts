import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildWorkflowDispatchRequest,
  dispatchWorkflow,
  getArgValue,
  hasFlag,
  normalizeGithubRepository,
  parseBooleanArg,
  resolveCurrentGitBranch,
  resolveWorkflowDispatchToken,
  type WorkflowDispatchFetch,
  type WorkflowDispatchInputs,
  type WorkflowDispatchRequest,
  type WorkflowDispatchResult,
} from './githubWorkflowDispatch'
import type { RenderDeployMode } from './syncRenderRuntimeEnv'

const DEFAULT_WORKFLOW = 'render_runtime_env_sync.yml'
const DEFAULT_SERVICE_NAME = 'parkking'
const USER_AGENT = 'ParkKing render runtime env sync dispatch'

export interface RenderRuntimeEnvSyncDispatchOptions {
  repo: string
  ref: string
  workflow: string
  serviceId: string
  serviceName: string
  handoffJsonPath: string
  packageUrl: string
  manifestUrl: string
  execute: boolean
  deploy: boolean
  deployMode: RenderDeployMode
  dryRun: boolean
  token?: string | null
}

type RenderRuntimeEnvSyncDispatchInputs = WorkflowDispatchInputs & {
  serviceId: string
  serviceName: string
  packageUrl: string
  manifestUrl: string
  execute: string
  deploy: string
  deployMode: string
}

export type RenderRuntimeEnvSyncDispatchRequest =
  WorkflowDispatchRequest<RenderRuntimeEnvSyncDispatchInputs>

export type RenderRuntimeEnvSyncDispatchResult =
  WorkflowDispatchResult<RenderRuntimeEnvSyncDispatchInputs>

const parseDeployMode = (value: string | null): RenderDeployMode => {
  if (value === null) {
    return 'build_and_deploy'
  }
  if (value === 'build_and_deploy' || value === 'deploy_only') {
    return value
  }
  throw new Error('--deploy-mode must be build_and_deploy or deploy_only')
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getString = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'string' ? record[key] : null

const readHandoffReleaseUrls = (handoffJsonPath: string) => {
  const parsed = toRecord(JSON.parse(fs.readFileSync(handoffJsonPath, 'utf-8')) as unknown)
  return {
    packageUrl: getString(parsed, 'packageUrl') ?? '',
    manifestUrl: getString(parsed, 'manifestUrl') ?? '',
  }
}

export const resolveRenderRuntimeEnvSyncDispatchOptions = (
  argv: string[],
): RenderRuntimeEnvSyncDispatchOptions => {
  const repo =
    normalizeGithubRepository(getArgValue(argv, '--repo')) ??
    normalizeGithubRepository(process.env.GITHUB_REPOSITORY)
  if (!repo) {
    throw new Error('Missing --repo owner/name or GITHUB_REPOSITORY')
  }

  const ref =
    getArgValue(argv, '--ref') ??
    process.env.GITHUB_REF_NAME ??
    resolveCurrentGitBranch()
  if (!ref) {
    throw new Error('Missing --ref and unable to resolve current git branch')
  }
  const handoffJsonPath = getArgValue(argv, '--handoff-json', '--handoffJson') ?? ''
  const handoffUrls = handoffJsonPath ? readHandoffReleaseUrls(handoffJsonPath) : null

  return {
    repo,
    ref,
    workflow: getArgValue(argv, '--workflow') ?? DEFAULT_WORKFLOW,
    serviceId:
      getArgValue(argv, '--service-id', '--serviceId') ??
      process.env.PARKKING_RENDER_SERVICE_ID ??
      process.env.RENDER_SERVICE_ID ??
      '',
    serviceName:
      getArgValue(argv, '--service-name', '--serviceName') ??
      process.env.PARKKING_RENDER_SERVICE_NAME ??
      process.env.RENDER_SERVICE_NAME ??
      DEFAULT_SERVICE_NAME,
    handoffJsonPath,
    packageUrl:
      getArgValue(argv, '--package-url', '--packageUrl') ??
      process.env.PARKKING_RELEASE_PACKAGE_URL ??
      handoffUrls?.packageUrl ??
      '',
    manifestUrl:
      getArgValue(argv, '--manifest-url', '--manifestUrl') ??
      process.env.PARKKING_RELEASE_MANIFEST_URL ??
      handoffUrls?.manifestUrl ??
      '',
    execute: parseBooleanArg(argv, '--execute', false),
    deploy: parseBooleanArg(argv, '--deploy', true),
    deployMode: parseDeployMode(getArgValue(argv, '--deploy-mode', '--deployMode')),
    dryRun: hasFlag(argv, '--dry-run'),
    token: resolveWorkflowDispatchToken(argv),
  }
}

const buildRenderRuntimeEnvSyncDispatchInputs = (
  options: RenderRuntimeEnvSyncDispatchOptions,
): RenderRuntimeEnvSyncDispatchInputs => ({
  serviceId: options.serviceId,
  serviceName: options.serviceName,
  packageUrl: options.packageUrl,
  manifestUrl: options.manifestUrl,
  execute: String(options.execute),
  deploy: String(options.deploy),
  deployMode: options.deployMode,
})

export const buildRenderRuntimeEnvSyncDispatchRequest = (
  options: RenderRuntimeEnvSyncDispatchOptions,
): RenderRuntimeEnvSyncDispatchRequest =>
  buildWorkflowDispatchRequest({
    repo: options.repo,
    ref: options.ref,
    workflow: options.workflow,
    inputs: buildRenderRuntimeEnvSyncDispatchInputs(options),
  })

export const renderRenderRuntimeEnvSyncDispatchPlan = (
  options: RenderRuntimeEnvSyncDispatchOptions,
  request = buildRenderRuntimeEnvSyncDispatchRequest(options),
) => [
  `# Render Runtime Env Sync Dispatch: ${options.dryRun ? 'DRY RUN' : 'READY'}`,
  '',
  `- Repository: ${options.repo}`,
  `- Ref: ${options.ref}`,
  `- Workflow: ${options.workflow}`,
  `- Service ID: ${options.serviceId || '-'}`,
  `- Service name: ${options.serviceName || '-'}`,
  `- Handoff JSON: ${options.handoffJsonPath || '-'}`,
  `- Release package URL: ${options.packageUrl || '-'}`,
  `- Release manifest URL: ${options.manifestUrl || '-'}`,
  `- Execute Render API changes: ${options.execute}`,
  `- Deploy after env sync: ${options.deploy}`,
  `- Deploy mode: ${options.deployMode}`,
  `- Endpoint: POST ${request.url}`,
  '',
  '## Payload',
  '',
  '```json',
  JSON.stringify(request.payload, null, 2),
  '```',
  '',
].join('\n')

export const dispatchRenderRuntimeEnvSyncWorkflow = async (
  options: RenderRuntimeEnvSyncDispatchOptions,
  fetchImpl: WorkflowDispatchFetch = fetch,
): Promise<RenderRuntimeEnvSyncDispatchResult> =>
  dispatchWorkflow(
    {
      repo: options.repo,
      ref: options.ref,
      workflow: options.workflow,
      inputs: buildRenderRuntimeEnvSyncDispatchInputs(options),
      dryRun: options.dryRun,
      token: options.token,
      userAgent: USER_AGENT,
    },
    fetchImpl,
  )

const run = async () => {
  const argv = process.argv.slice(2)
  if (hasFlag(argv, '--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/dispatchRenderRuntimeEnvSyncWorkflow.ts [options]',
        '',
        'Options:',
        '  --repo <owner/name>                  Defaults to GITHUB_REPOSITORY',
        '  --ref <branch>                      Defaults to GITHUB_REF_NAME or current git branch',
        '  --service-id <id>                   Optional Render service ID',
        '  --service-name <name>               Defaults to parkking',
        '  --handoff-json <path>               Reads packageUrl and manifestUrl into workflow inputs',
        '  --package-url <url>                 Optional release package URL workflow input',
        '  --manifest-url <url>                Optional release manifest URL workflow input',
        '  --execute [true|false]              Workflow input; defaults to false',
        '  --deploy [true|false]               Workflow input; defaults to true',
        '  --deploy-mode <mode>                build_and_deploy or deploy_only; defaults to build_and_deploy',
        '  --workflow <file>                   Defaults to render_runtime_env_sync.yml',
        '  --token-env <name>                  Dispatch token env var; defaults to GH_TOKEN then GITHUB_TOKEN',
        '  --dry-run                           Print request without dispatching',
      ].join('\n'),
    )
    return
  }

  const options = resolveRenderRuntimeEnvSyncDispatchOptions(argv)
  console.log(renderRenderRuntimeEnvSyncDispatchPlan(options))
  const result = await dispatchRenderRuntimeEnvSyncWorkflow(options)
  if (result.dispatched) {
    console.log(`Render Runtime Env Sync workflow dispatched: HTTP ${result.status}`)
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
