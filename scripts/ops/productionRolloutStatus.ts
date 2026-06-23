import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getArgValue, hasFlag } from './githubWorkflowDispatch'
import {
  buildReleasePublishRequest,
  detectReleasePublishRequestEnvironment,
  type ReleasePublishRequestEnvironment,
  type ReleasePublishRequestOptions,
  type ReleasePublishRequestResult,
} from './releasePublishRequest'
import {
  verifyRenderDeployment,
  type RenderDeploymentVerifyOptions,
  type RenderDeploymentVerifyResult,
} from './renderDeploymentVerify'

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_READINESS_JSON = '.tmp/release-handoff-readiness.json'
const DEFAULT_OUT_PATH = '.tmp/production-rollout-status.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/production-rollout-status.json'
const DEFAULT_TIMEOUT_MS = 60000

type FetchImpl = typeof fetch

export type ProductionRolloutState =
  | 'blocked'
  | 'ready_for_release_publish'
  | 'release_published_needs_render'
  | 'ready_for_live_verify'
  | 'needs_render_env_sync'
  | 'live_verified'
  | 'live_verify_failed'

export interface ProductionRolloutStatusOptions {
  handoffJsonPath?: string | null
  readinessJsonPath?: string | null
  repository?: string | null
  ref?: string | null
  targetSha?: string | null
  appUrl?: string | null
  timeoutMs?: number | null
  skipReleaseLookup?: boolean | null
  checkLive?: boolean | null
  requireLivePass?: boolean | null
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface ProductionRolloutCredentialSummary {
  ghTokenPresent: boolean
  githubTokenPresent: boolean
  renderServiceIdPresent: boolean
  renderApiKeyPresent: boolean
  renderCliAvailable: boolean
  canPreviewServiceIdPlan: boolean
  canApplyDirectRenderSync: boolean
  canDispatchRenderSyncWorkflow: boolean
}

export interface ProductionRolloutLiveVerify {
  checked: boolean
  pass: boolean | null
  result: RenderDeploymentVerifyResult | null
  error: string | null
}

export interface ProductionRolloutCommands {
  refreshHandoff: string
  releaseRequest: string
  rolloutStatus: string
  rolloutStatusCheckLive: string
  renderEnvSyncServiceIdDryRun: string
  renderEnvSyncServiceIdApply: string
  renderEnvSyncServiceNameDryRun: string
  renderEnvSyncServiceNameApply: string
  renderEnvSyncDispatchDryRun: string
  renderEnvSyncDispatch: string
  renderLiveVerifyLocal: string
}

export interface ProductionRolloutStatusResult {
  state: ProductionRolloutState
  releaseRequest: ReleasePublishRequestResult
  credentials: ProductionRolloutCredentialSummary
  liveVerify: ProductionRolloutLiveVerify
  commands: ProductionRolloutCommands
  nextActions: string[]
  blockers: string[]
  warnings: string[]
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

export const parseProductionRolloutStatusArgs = (
  argv: string[],
): ProductionRolloutStatusOptions => ({
  handoffJsonPath:
    getArgValue(argv, '--handoff-json', '--handoffJson') ?? DEFAULT_HANDOFF_JSON,
  readinessJsonPath:
    getArgValue(argv, '--readiness-json', '--readinessJson') ??
    DEFAULT_READINESS_JSON,
  repository: getArgValue(argv, '--repo', '--repository'),
  ref: getArgValue(argv, '--ref'),
  targetSha: getArgValue(argv, '--target-sha', '--targetSha'),
  appUrl:
    getArgValue(argv, '--app-url', '--appUrl') ??
    process.env.PARKKING_RENDER_APP_URL ??
    null,
  timeoutMs:
    parsePositiveInteger(getArgValue(argv, '--timeout-ms', '--timeoutMs'), 'timeout-ms') ??
    DEFAULT_TIMEOUT_MS,
  skipReleaseLookup: hasFlag(argv, '--skip-release-lookup'),
  checkLive: hasFlag(argv, '--check-live') || hasFlag(argv, '--checkLive'),
  requireLivePass:
    hasFlag(argv, '--require-live-pass') || hasFlag(argv, '--requireLivePass'),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
})

const quoteCommandValue = (value: string) =>
  /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value

const credentialSummary = (
  environment: ReleasePublishRequestEnvironment,
): ProductionRolloutCredentialSummary => ({
  ghTokenPresent: environment.ghTokenPresent,
  githubTokenPresent: environment.githubTokenPresent,
  renderServiceIdPresent: environment.renderServiceIdPresent,
  renderApiKeyPresent: environment.renderApiKeyPresent,
  renderCliAvailable: environment.renderCliAvailable,
  canPreviewServiceIdPlan: environment.renderServiceIdPresent,
  canApplyDirectRenderSync: environment.renderApiKeyPresent,
  canDispatchRenderSyncWorkflow:
    environment.ghTokenPresent || environment.githubTokenPresent,
})

const buildCommands = (
  request: ReleasePublishRequestResult,
  options: ProductionRolloutStatusOptions,
): ProductionRolloutCommands => {
  const ref = request.status.ref
  const appUrl = request.status.appUrl ?? '<Render service URL>'
  const handoffJsonPath = quoteCommandValue(options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON)
  const appUrlArg = quoteCommandValue(appUrl)
  const rolloutBase = `npm run ops:production-rollout-status -- --ref ${quoteCommandValue(ref)} --app-url ${appUrlArg} --handoff-json ${handoffJsonPath}`
  return {
    refreshHandoff: request.commands.refreshHandoff,
    releaseRequest: `npm run ops:release-publish-request -- --ref ${quoteCommandValue(ref)} --app-url ${appUrlArg}`,
    rolloutStatus: rolloutBase,
    rolloutStatusCheckLive: `${rolloutBase} --check-live`,
    renderEnvSyncServiceIdDryRun: request.commands.renderEnvSyncServiceIdDryRun,
    renderEnvSyncServiceIdApply: request.commands.renderEnvSyncServiceIdApply,
    renderEnvSyncServiceNameDryRun: request.commands.renderEnvSyncServiceNameDryRun,
    renderEnvSyncServiceNameApply: request.commands.renderEnvSyncServiceNameApply,
    renderEnvSyncDispatchDryRun: request.commands.renderEnvSyncDispatchDryRun,
    renderEnvSyncDispatch: request.commands.renderEnvSyncDispatch,
    renderLiveVerifyLocal: request.commands.localRenderVerify,
  }
}

const runLiveVerify = async (
  options: ProductionRolloutStatusOptions,
): Promise<ProductionRolloutLiveVerify> => {
  if (!options.checkLive) {
    return { checked: false, pass: null, result: null, error: null }
  }
  if (!options.appUrl) {
    return {
      checked: true,
      pass: false,
      result: null,
      error: 'Render app URL is required for --check-live',
    }
  }
  const verifyOptions: RenderDeploymentVerifyOptions = {
    appUrl: options.appUrl,
    handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }
  try {
    const result = await verifyRenderDeployment(verifyOptions)
    return { checked: true, pass: result.pass, result, error: null }
  } catch (error) {
    return {
      checked: true,
      pass: false,
      result: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const buildState = (
  request: ReleasePublishRequestResult,
  liveVerify: ProductionRolloutLiveVerify,
): ProductionRolloutState => {
  if (request.state === 'blocked') {
    return 'blocked'
  }
  if (request.state === 'ready_for_release_publish') {
    return 'ready_for_release_publish'
  }
  if (request.state === 'release_published_needs_render') {
    return 'release_published_needs_render'
  }
  if (!liveVerify.checked) {
    return 'ready_for_live_verify'
  }
  if (liveVerify.pass === true) {
    return 'live_verified'
  }
  return liveVerify.result ? 'needs_render_env_sync' : 'live_verify_failed'
}

const liveVerifyFailures = (liveVerify: ProductionRolloutLiveVerify) => {
  if (!liveVerify.result) {
    return liveVerify.error ? [liveVerify.error] : []
  }
  return liveVerify.result.errors
}

const buildNextActions = (
  state: ProductionRolloutState,
  commands: ProductionRolloutCommands,
  credentials: ProductionRolloutCredentialSummary,
) => {
  if (state === 'live_verified') {
    return ['Production rollout is live-verified; no Render action is required.']
  }
  if (state === 'blocked') {
    return [`Refresh local release handoff gates: ${commands.refreshHandoff}`]
  }
  if (state === 'ready_for_release_publish') {
    return [`Generate the release publish request: ${commands.releaseRequest}`]
  }
  if (state === 'release_published_needs_render') {
    return [
      `Preview Render env sync: ${commands.renderEnvSyncServiceIdDryRun}`,
      `Apply Render env sync and deploy after credentials are present: ${commands.renderEnvSyncServiceIdApply}`,
    ]
  }
  if (state === 'ready_for_live_verify') {
    return [`Check live Render deployment before calling rollout complete: ${commands.rolloutStatusCheckLive}`]
  }
  const credentialAction = credentials.canApplyDirectRenderSync
    ? `Apply Render env sync and deploy: ${
        credentials.renderServiceIdPresent
          ? commands.renderEnvSyncServiceIdApply
          : commands.renderEnvSyncServiceNameApply
      }`
    : credentials.canDispatchRenderSyncWorkflow
      ? `Dispatch Render env sync workflow after confirming repository RENDER_API_KEY secret exists: ${commands.renderEnvSyncDispatch}`
      : 'Provide RENDER_API_KEY plus PARKKING_RENDER_SERVICE_ID/RENDER_SERVICE_ID, or update Render env vars through the dashboard.'
  return [
    credentialAction,
    `After Render deploy completes, rerun live verification: ${commands.rolloutStatusCheckLive}`,
  ]
}

export const buildProductionRolloutStatus = async (
  options: ProductionRolloutStatusOptions = {},
  fetchImpl: FetchImpl = fetch,
  environment: ReleasePublishRequestEnvironment = detectReleasePublishRequestEnvironment(),
): Promise<ProductionRolloutStatusResult> => {
  const requestOptions: ReleasePublishRequestOptions = {
    handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON,
    readinessJsonPath: options.readinessJsonPath ?? DEFAULT_READINESS_JSON,
    repository: options.repository,
    ref: options.ref,
    targetSha: options.targetSha,
    appUrl: options.appUrl,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    skipReleaseLookup: options.skipReleaseLookup,
  }
  const releaseRequest = await buildReleasePublishRequest(
    requestOptions,
    fetchImpl,
    environment,
  )
  const liveVerify = await runLiveVerify({
    ...options,
    appUrl: releaseRequest.status.appUrl,
    handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  })
  const credentials = credentialSummary(environment)
  const state = buildState(releaseRequest, liveVerify)
  const commands = buildCommands(releaseRequest, {
    ...options,
    handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON,
  })
  const blockers = [
    ...releaseRequest.blockers,
    ...(state === 'needs_render_env_sync' && !credentials.canApplyDirectRenderSync
      ? ['Render env sync/deploy cannot be applied from this environment because RENDER_API_KEY is missing']
      : []),
  ]
  const warnings = [
    ...releaseRequest.warnings,
    ...(liveVerify.checked && liveVerify.pass === false
      ? liveVerifyFailures(liveVerify).map((failure) => `Live verify: ${failure}`)
      : []),
  ]

  return {
    state,
    releaseRequest,
    credentials,
    liveVerify,
    commands,
    nextActions: buildNextActions(state, commands, credentials),
    blockers,
    warnings,
  }
}

const statusText = (value: boolean | null) =>
  value === true ? 'yes' : value === false ? 'no' : 'unknown'

const remediationSummary = (result: RenderDeploymentVerifyResult | null) => [
  ...(result?.releasePackageRemediation
    ? [
        `- Release package remediation: ${result.releasePackageRemediation.reasons.join(' ')}`,
      ]
    : []),
  ...(result?.remediation
    ? [`- Runtime remediation: ${result.remediation.reasons.join(' ')}`]
    : []),
]

export const renderProductionRolloutStatus = (
  result: ProductionRolloutStatusResult,
) =>
  [
    `# Production Rollout Status: ${result.state.toUpperCase()}`,
    '',
    '## Release',
    '',
    `- Ref: ${result.releaseRequest.status.ref}`,
    `- Target SHA: ${result.releaseRequest.status.targetSha ?? '-'}`,
    `- Release ID: ${result.releaseRequest.status.release.releaseId}`,
    `- GitHub Release published: ${statusText(result.releaseRequest.status.releaseLookup.published)}`,
    `- Published manifest parity: ${statusText(result.releaseRequest.status.publishedManifest.pass)}`,
    `- Render app URL: ${result.releaseRequest.status.appUrl ?? '-'}`,
    '',
    '## Credentials',
    '',
    `- RENDER_API_KEY present: ${statusText(result.credentials.renderApiKeyPresent)}`,
    `- PARKKING_RENDER_SERVICE_ID/RENDER_SERVICE_ID present: ${statusText(result.credentials.renderServiceIdPresent)}`,
    `- GH_TOKEN/GITHUB_TOKEN present: ${statusText(result.credentials.canDispatchRenderSyncWorkflow)}`,
    `- Can preview service-id plan: ${statusText(result.credentials.canPreviewServiceIdPlan)}`,
    `- Can apply direct Render sync: ${statusText(result.credentials.canApplyDirectRenderSync)}`,
    `- Can dispatch Render sync workflow: ${statusText(result.credentials.canDispatchRenderSyncWorkflow)}`,
    '',
    '## Live Verify',
    '',
    `- Checked: ${statusText(result.liveVerify.checked)}`,
    `- Pass: ${statusText(result.liveVerify.pass)}`,
    `- Error: ${result.liveVerify.error ?? '-'}`,
    ...(result.liveVerify.result
      ? [
          `- Dataset districts: ${result.liveVerify.result.districts.filter((district) => district.pass).length}/${result.liveVerify.result.districts.length} pass`,
          `- Sync CORS: ${statusText(result.liveVerify.result.syncCors?.pass ?? null)}`,
          `- Proxy runtime: ${statusText(result.liveVerify.result.proxyRuntime?.every((entry) => entry.pass) ?? null)}`,
        ]
      : []),
    ...remediationSummary(result.liveVerify.result),
    '',
    '## Next Actions',
    '',
    ...result.nextActions.map((action) => `- ${action}`),
    '',
    '## Key Commands',
    '',
    `- Rollout status: ${result.commands.rolloutStatus}`,
    `- Rollout status with live check: ${result.commands.rolloutStatusCheckLive}`,
    `- Render env sync dry-run: ${result.commands.renderEnvSyncServiceIdDryRun}`,
    `- Render env sync apply: ${result.commands.renderEnvSyncServiceIdApply}`,
    `- Render env sync workflow dispatch: ${result.commands.renderEnvSyncDispatch}`,
    `- Local live verify: ${result.commands.renderLiveVerifyLocal}`,
    '',
    '## Blockers',
    '',
    ...(result.blockers.length > 0
      ? result.blockers.map((blocker) => `- ${blocker}`)
      : ['- none']),
    '',
    '## Warnings',
    '',
    ...(result.warnings.length > 0
      ? result.warnings.map((warning) => `- ${warning}`)
      : ['- none']),
  ].join('\n')

export const writeProductionRolloutStatusOutputs = async (
  result: ProductionRolloutStatusResult,
  options: Pick<ProductionRolloutStatusOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${renderProductionRolloutStatus(result)}\n`, 'utf-8')
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
        'Usage: tsx scripts/ops/productionRolloutStatus.ts [options]',
        '',
        'Options:',
        '  --handoff-json <path>       Defaults to .tmp/render-deployment-handoff.json',
        '  --readiness-json <path>     Defaults to .tmp/release-handoff-readiness.json',
        '  --repo <owner/name>         Overrides repository for release status lookup',
        '  --ref <branch>              Defaults to current status resolver',
        '  --target-sha <sha>          Override git rev-parse <ref>',
        '  --app-url <url>             Render service URL for live verification',
        '  --check-live                Run live Render verification and include drift/remediation',
        '  --require-live-pass         Exit nonzero unless live verification passes',
        '  --skip-release-lookup       Do not query GitHub Release status',
        '  --out <path>                Defaults to .tmp/production-rollout-status.md',
        '  --json-out <path>           Defaults to .tmp/production-rollout-status.json',
      ].join('\n'),
    )
    return
  }

  const options = parseProductionRolloutStatusArgs(argv)
  const result = await buildProductionRolloutStatus(options)
  await writeProductionRolloutStatusOutputs(result, options)
  console.log(renderProductionRolloutStatus(result))
  if (options.requireLivePass && result.state !== 'live_verified') {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
