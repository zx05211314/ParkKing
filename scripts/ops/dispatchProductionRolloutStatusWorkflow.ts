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

const DEFAULT_WORKFLOW = 'production_rollout_status.yml'
const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const USER_AGENT = 'ParkKing production rollout status dispatch'

interface ProductionRolloutHandoffJson {
  repository?: unknown
  packageUrl?: unknown
  manifestUrl?: unknown
  renderEnv?: {
    PARKKING_RELEASE_PACKAGE_URL?: unknown
    PARKKING_RELEASE_MANIFEST_URL?: unknown
  }
}

export interface ProductionRolloutStatusDispatchOptions {
  repo: string
  ref: string
  workflow: string
  appUrl: string
  packageUrl: string
  manifestUrl: string
  checkLive: boolean
  requireLivePass: boolean
  skipReleaseLookup: boolean
  dryRun: boolean
  token?: string | null
}

type ProductionRolloutStatusDispatchInputs = WorkflowDispatchInputs & {
  appUrl: string
  manifestUrl: string
  packageUrl: string
  checkLive: string
  requireLivePass: string
  skipReleaseLookup: string
}

export type ProductionRolloutStatusDispatchRequest =
  WorkflowDispatchRequest<ProductionRolloutStatusDispatchInputs>

export type ProductionRolloutStatusDispatchResult =
  WorkflowDispatchResult<ProductionRolloutStatusDispatchInputs>

const readHandoffJson = async (filePath: string) => {
  try {
    return JSON.parse(
      await fs.readFile(filePath, 'utf-8'),
    ) as ProductionRolloutHandoffJson
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const optionalHandoffString = (
  handoff: ProductionRolloutHandoffJson | null,
  key: 'packageUrl' | 'manifestUrl',
  envKey: 'PARKKING_RELEASE_PACKAGE_URL' | 'PARKKING_RELEASE_MANIFEST_URL',
) =>
  (typeof handoff?.[key] === 'string' ? handoff[key] : null) ??
  (typeof handoff?.renderEnv?.[envKey] === 'string'
    ? handoff.renderEnv[envKey]
    : null)

export const resolveProductionRolloutStatusDispatchOptions = async (
  argv: string[],
): Promise<ProductionRolloutStatusDispatchOptions> => {
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
    getArgValue(argv, '--app-url', '--appUrl') ?? process.env.PARKKING_RENDER_APP_URL
  if (!appUrl) {
    throw new Error('Missing --app-url <Render service URL>')
  }
  validateHttpUrl(appUrl, '--app-url')

  const manifestUrl =
    getArgValue(argv, '--manifest-url', '--manifestUrl') ??
    process.env.PARKKING_RELEASE_MANIFEST_URL ??
    optionalHandoffString(handoff, 'manifestUrl', 'PARKKING_RELEASE_MANIFEST_URL')
  if (!manifestUrl) {
    throw new Error(
      `Missing --manifest-url and no manifestUrl found in ${handoffPath}`,
    )
  }
  validateHttpUrl(manifestUrl, '--manifest-url')

  const packageUrl =
    getArgValue(argv, '--package-url', '--packageUrl') ??
    process.env.PARKKING_RELEASE_PACKAGE_URL ??
    optionalHandoffString(handoff, 'packageUrl', 'PARKKING_RELEASE_PACKAGE_URL') ??
    ''
  if (packageUrl) {
    validateHttpUrl(packageUrl, '--package-url')
  }

  return {
    repo,
    ref,
    workflow: getArgValue(argv, '--workflow') ?? DEFAULT_WORKFLOW,
    appUrl,
    packageUrl,
    manifestUrl,
    checkLive: parseBooleanArg(argv, '--check-live', true),
    requireLivePass: parseBooleanArg(argv, '--require-live-pass', false),
    skipReleaseLookup: parseBooleanArg(argv, '--skip-release-lookup', false),
    dryRun: hasFlag(argv, '--dry-run'),
    token: resolveWorkflowDispatchToken(argv),
  }
}

const buildProductionRolloutStatusDispatchInputs = (
  options: ProductionRolloutStatusDispatchOptions,
): ProductionRolloutStatusDispatchInputs => ({
  appUrl: options.appUrl,
  manifestUrl: options.manifestUrl,
  packageUrl: options.packageUrl,
  checkLive: String(options.checkLive),
  requireLivePass: String(options.requireLivePass),
  skipReleaseLookup: String(options.skipReleaseLookup),
})

export const buildProductionRolloutStatusDispatchRequest = (
  options: ProductionRolloutStatusDispatchOptions,
): ProductionRolloutStatusDispatchRequest =>
  buildWorkflowDispatchRequest({
    repo: options.repo,
    ref: options.ref,
    workflow: options.workflow,
    inputs: buildProductionRolloutStatusDispatchInputs(options),
  })

export const renderProductionRolloutStatusDispatchPlan = (
  options: ProductionRolloutStatusDispatchOptions,
  request = buildProductionRolloutStatusDispatchRequest(options),
) => [
  `# Production Rollout Status Dispatch: ${options.dryRun ? 'DRY RUN' : 'READY'}`,
  '',
  `- Repository: ${options.repo}`,
  `- Ref: ${options.ref}`,
  `- Workflow: ${options.workflow}`,
  `- App URL: ${options.appUrl}`,
  `- Package URL: ${options.packageUrl || '-'}`,
  `- Manifest URL: ${options.manifestUrl}`,
  `- Check live deployment: ${options.checkLive}`,
  `- Require live pass: ${options.requireLivePass}`,
  `- Skip release lookup: ${options.skipReleaseLookup}`,
  `- Endpoint: POST ${request.url}`,
  '',
  '## Payload',
  '',
  '```json',
  JSON.stringify(request.payload, null, 2),
  '```',
  '',
].join('\n')

export const dispatchProductionRolloutStatusWorkflow = async (
  options: ProductionRolloutStatusDispatchOptions,
  fetchImpl: WorkflowDispatchFetch = fetch,
): Promise<ProductionRolloutStatusDispatchResult> =>
  dispatchWorkflow(
    {
      repo: options.repo,
      ref: options.ref,
      workflow: options.workflow,
      inputs: buildProductionRolloutStatusDispatchInputs(options),
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
        'Usage: tsx scripts/ops/dispatchProductionRolloutStatusWorkflow.ts --app-url <Render URL> [options]',
        '',
        'Options:',
        '  --repo <owner/name>                  Defaults to GITHUB_REPOSITORY or handoff JSON repository',
        '  --ref <branch>                      Defaults to GITHUB_REF_NAME or current git branch',
        '  --manifest-url <url>                Defaults to PARKKING_RELEASE_MANIFEST_URL or handoff JSON',
        '  --package-url <url>                 Optional package URL; workflow can infer standard filenames',
        '  --handoff-json <path>               Defaults to .tmp/render-deployment-handoff.json',
        '  --check-live [true|false]           Workflow input; defaults to true',
        '  --require-live-pass [true|false]    Workflow input; defaults to false',
        '  --skip-release-lookup [true|false]  Workflow input; defaults to false',
        '  --workflow <file>                   Defaults to production_rollout_status.yml',
        '  --token-env <name>                  Dispatch token env var; defaults to GH_TOKEN then GITHUB_TOKEN',
        '  --dry-run                           Print request without dispatching',
      ].join('\n'),
    )
    return
  }

  const options = await resolveProductionRolloutStatusDispatchOptions(argv)
  console.log(renderProductionRolloutStatusDispatchPlan(options))
  const result = await dispatchProductionRolloutStatusWorkflow(options)
  if (result.dispatched) {
    console.log(`Production Rollout Status workflow dispatched: HTTP ${result.status}`)
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
