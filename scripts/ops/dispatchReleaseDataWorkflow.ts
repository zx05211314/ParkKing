import { fileURLToPath } from 'node:url'
import {
  buildWorkflowDispatchRequest,
  dispatchWorkflow,
  getArgValue,
  hasFlag,
  parseBooleanArg,
  resolveCurrentGitBranch,
  resolveWorkflowDispatchToken,
  type WorkflowDispatchFetch,
  type WorkflowDispatchInputs,
  type WorkflowDispatchRequest,
  type WorkflowDispatchResult,
} from './githubWorkflowDispatch'

const DEFAULT_WORKFLOW = 'release_data.yml'
const DEFAULT_CONFIGS_GLOB = 'configs/prod/*.json'
const USER_AGENT = 'ParkKing release data dispatch'

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

type ReleaseDataDispatchInputs = WorkflowDispatchInputs & {
  configsGlob: string
  allowWarn: string
  overrideReason: string
  tag: string
  latest: string
}

export type ReleaseDataDispatchRequest =
  WorkflowDispatchRequest<ReleaseDataDispatchInputs>

export type ReleaseDataDispatchResult =
  WorkflowDispatchResult<ReleaseDataDispatchInputs>

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
    token: resolveWorkflowDispatchToken(argv),
  }
}

const buildReleaseDataDispatchInputs = (
  options: ReleaseDataDispatchOptions,
): ReleaseDataDispatchInputs => ({
  configsGlob: options.configsGlob,
  allowWarn: String(options.allowWarn),
  overrideReason: options.overrideReason,
  tag: options.tag,
  latest: String(options.latest),
})

export const buildReleaseDataDispatchRequest = (
  options: ReleaseDataDispatchOptions,
): ReleaseDataDispatchRequest =>
  buildWorkflowDispatchRequest({
    repo: options.repo,
    ref: options.ref,
    workflow: options.workflow,
    inputs: buildReleaseDataDispatchInputs(options),
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
  fetchImpl: WorkflowDispatchFetch = fetch,
): Promise<ReleaseDataDispatchResult> =>
  dispatchWorkflow(
    {
      repo: options.repo,
      ref: options.ref,
      workflow: options.workflow,
      inputs: buildReleaseDataDispatchInputs(options),
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
