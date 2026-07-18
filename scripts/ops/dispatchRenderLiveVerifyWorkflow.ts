import * as fs from 'node:fs/promises'
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
  validateHttpUrl,
  type WorkflowDispatchFetch,
  type WorkflowDispatchInputs,
  type WorkflowDispatchRequest,
  type WorkflowDispatchResult,
} from './githubWorkflowDispatch'

const DEFAULT_WORKFLOW = 'render_live_verify.yml'
const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const USER_AGENT = 'ParkKing render live verify dispatch'

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
  allParkingAnswerCases: boolean
  dryRun: boolean
  token?: string | null
}

type RenderLiveVerifyDispatchInputs = WorkflowDispatchInputs & {
  appUrl: string
  manifestUrl: string
  useGithubToken: string
  skipSyncIssueRoundtrip: string
  allParkingAnswerCases: string
}

export type RenderLiveVerifyDispatchRequest =
  WorkflowDispatchRequest<RenderLiveVerifyDispatchInputs>

export type RenderLiveVerifyDispatchResult =
  WorkflowDispatchResult<RenderLiveVerifyDispatchInputs>

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

export const resolveRenderLiveVerifyDispatchOptions = async (
  argv: string[],
): Promise<RenderLiveVerifyDispatchOptions> => {
  const handoffPath =
    getArgValue(argv, '--handoff-json', '--handoffJson') ?? DEFAULT_HANDOFF_JSON
  const handoff = await readHandoffJson(handoffPath)
  const repo =
    normalizeGithubRepository(getArgValue(argv, '--repo')) ??
    normalizeGithubRepository(process.env.GITHUB_REPOSITORY) ??
    normalizeGithubRepository(
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
  validateHttpUrl(appUrl, '--app-url')

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
  validateHttpUrl(manifestUrl, '--manifest-url')

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
    allParkingAnswerCases: parseBooleanArg(
      argv,
      '--all-parking-answer-cases',
      true,
    ),
    dryRun: hasFlag(argv, '--dry-run'),
    token: resolveWorkflowDispatchToken(argv),
  }
}

const buildRenderLiveVerifyDispatchInputs = (
  options: RenderLiveVerifyDispatchOptions,
): RenderLiveVerifyDispatchInputs => ({
  appUrl: options.appUrl,
  manifestUrl: options.manifestUrl,
  useGithubToken: String(options.useGithubToken),
  skipSyncIssueRoundtrip: String(options.skipSyncIssueRoundtrip),
  allParkingAnswerCases: String(options.allParkingAnswerCases),
})

export const buildRenderLiveVerifyDispatchRequest = (
  options: RenderLiveVerifyDispatchOptions,
): RenderLiveVerifyDispatchRequest =>
  buildWorkflowDispatchRequest({
    repo: options.repo,
    ref: options.ref,
    workflow: options.workflow,
    inputs: buildRenderLiveVerifyDispatchInputs(options),
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
  `- Verify all reviewed parking-answer cases: ${options.allParkingAnswerCases}`,
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
  fetchImpl: WorkflowDispatchFetch = fetch,
): Promise<RenderLiveVerifyDispatchResult> =>
  dispatchWorkflow(
    {
      repo: options.repo,
      ref: options.ref,
      workflow: options.workflow,
      inputs: buildRenderLiveVerifyDispatchInputs(options),
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
        'Usage: tsx scripts/ops/dispatchRenderLiveVerifyWorkflow.ts --app-url <Render URL> [options]',
        '',
        'Options:',
        '  --repo <owner/name>                  Defaults to GITHUB_REPOSITORY or handoff JSON repository',
        '  --ref <branch>                      Defaults to GITHUB_REF_NAME or current git branch',
        '  --manifest-url <url>                Defaults to PARKKING_RELEASE_MANIFEST_URL or handoff JSON',
        '  --handoff-json <path>               Defaults to .tmp/render-deployment-handoff.json',
        '  --use-github-token [true|false]     Workflow input for private release assets',
        '  --skip-sync-issue-roundtrip         Workflow input for live environments that reject smoke writes',
        '  --all-parking-answer-cases [bool]   Verify all reviewed cases; defaults to true',
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
