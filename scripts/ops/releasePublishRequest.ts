import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  getArgValue,
  hasFlag,
  resolveWorkflowDispatchToken,
} from './githubWorkflowDispatch'
import {
  buildReleaseHandoffStatus,
  type ReleaseHandoffStatusOptions,
  type ReleaseHandoffStatusResult,
} from './releaseHandoffStatus'
import {
  buildPublishReleaseDataFromHandoffPlan,
  type PublishReleaseDataFromHandoffPlan,
} from './publishReleaseDataFromHandoff'
import {
  REQUIRED_RENDER_RUNTIME_ENV,
  buildRenderDeploymentEnv,
  renderEnvAssignments,
} from './renderDeploymentEnv'

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_READINESS_JSON = '.tmp/release-handoff-readiness.json'
const DEFAULT_READINESS_MD = '.tmp/p3-release-readiness.md'
const DEFAULT_RELEASE_DIR = 'dist/releases'
const DEFAULT_OUT_PATH = '.tmp/release-publish-request.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/release-publish-request.json'
const DEFAULT_TIMEOUT_MS = 15000

type FetchImpl = typeof fetch

export interface ReleasePublishRequestOptions {
  handoffJsonPath?: string | null
  readinessJsonPath?: string | null
  readinessMarkdownPath?: string | null
  releaseDir?: string | null
  repository?: string | null
  ref?: string | null
  targetSha?: string | null
  appUrl?: string | null
  timeoutMs?: number | null
  skipReleaseLookup?: boolean | null
  token?: string | null
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface ReleasePublishRequestEnvironment {
  ghTokenPresent: boolean
  githubTokenPresent: boolean
  githubRepository: string | null
  ghCliAvailable: boolean
  renderServiceIdPresent: boolean
  renderApiKeyPresent: boolean
  renderCliAvailable: boolean
}

export interface ReleasePublishRequestAsset {
  name: string
  path: string
  sizeBytes: number
  sha256: string
  expectedUrl: string
}

export interface ReleasePublishRequestManualPublish {
  githubNewReleaseUrl: string
  expectedReleaseUrl: string
  releaseTag: string
  releaseTitle: string
  assetDirectory: string | null
  uploadAssetPaths: string[]
}

export interface ReleasePublishRequestCommands {
  refreshHandoff: string
  status: string
  exactLocalPublishDryRun: string
  exactLocalPublish: string
  workflowDispatchDryRun: string
  workflowDispatch: string
  releaseTagPush: string
  urlSmokeEnv: string[]
  urlSmoke: string
  renderEnv: string[]
  renderEnvSyncServiceIdDryRun: string
  renderEnvSyncServiceIdApply: string
  renderEnvSyncServiceNameDryRun: string
  renderEnvSyncServiceNameApply: string
  renderEnvSyncDispatchDryRun: string
  renderEnvSyncDispatch: string
  renderLiveVerifyDryRun: string
  renderLiveVerify: string
  localRenderVerify: string
}

export interface ReleasePublishRequestResult {
  state:
    | 'blocked'
    | 'ready_for_release_publish'
    | 'release_published_needs_render'
    | 'ready_for_render_live_verify'
  status: ReleaseHandoffStatusResult
  publishPlan: PublishReleaseDataFromHandoffPlan | null
  environment: ReleasePublishRequestEnvironment
  assets: ReleasePublishRequestAsset[]
  manualPublish: ReleasePublishRequestManualPublish
  commands: ReleasePublishRequestCommands
  blockers: string[]
  externalRequirements: string[]
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

export const parseReleasePublishRequestArgs = (
  argv: string[],
): ReleasePublishRequestOptions => ({
  handoffJsonPath:
    getArgValue(argv, '--handoff-json', '--handoffJson') ?? DEFAULT_HANDOFF_JSON,
  readinessJsonPath:
    getArgValue(argv, '--readiness-json', '--readinessJson') ??
    DEFAULT_READINESS_JSON,
  readinessMarkdownPath:
    getArgValue(argv, '--readiness-md', '--readinessMd') ?? DEFAULT_READINESS_MD,
  releaseDir: getArgValue(argv, '--release-dir', '--releaseDir') ?? DEFAULT_RELEASE_DIR,
  repository: getArgValue(argv, '--repo', '--repository'),
  ref: getArgValue(argv, '--ref'),
  targetSha: getArgValue(argv, '--target-sha', '--targetSha'),
  appUrl: getArgValue(argv, '--app-url', '--appUrl'),
  timeoutMs:
    parsePositiveInteger(getArgValue(argv, '--timeout-ms', '--timeoutMs'), 'timeout-ms') ??
    DEFAULT_TIMEOUT_MS,
  skipReleaseLookup: hasFlag(argv, '--skip-release-lookup'),
  token: resolveWorkflowDispatchToken(argv),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
})

const commandAvailable = (command: string) => {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return result.status === 0
}

export const detectReleasePublishRequestEnvironment =
  (): ReleasePublishRequestEnvironment => ({
    ghTokenPresent: Boolean(process.env.GH_TOKEN),
    githubTokenPresent: Boolean(process.env.GITHUB_TOKEN),
    githubRepository: process.env.GITHUB_REPOSITORY ?? null,
    ghCliAvailable: commandAvailable('gh'),
    renderServiceIdPresent: Boolean(
      process.env.PARKKING_RENDER_SERVICE_ID || process.env.RENDER_SERVICE_ID,
    ),
    renderApiKeyPresent: Boolean(process.env.RENDER_API_KEY),
    renderCliAvailable: commandAvailable('render'),
  })

const quoteCommandValue = (value: string) =>
  /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value

const uniqueLines = (values: string[]) => [...new Set(values)]

const localBlockersFromStatus = (status: ReleaseHandoffStatusResult) =>
  status.blockers.filter(
    (blocker) =>
      !blocker.startsWith('GitHub Release ') &&
      !blocker.startsWith('Published release manifest '),
  )

const renderAppUrlOrPlaceholder = (status: ReleaseHandoffStatusResult) =>
  status.appUrl ?? '<Render service URL>'

const buildCommands = (
  status: ReleaseHandoffStatusResult,
): ReleasePublishRequestCommands => {
  const appUrl = renderAppUrlOrPlaceholder(status)
  return {
    refreshHandoff: 'npm run ops:release-handoff-readiness',
    status: `npm run ops:release-handoff-status -- --ref ${status.ref}`,
    exactLocalPublishDryRun: `npm run ops:release-data-publish-handoff -- --ref ${status.ref} --dry-run`,
    exactLocalPublish: `npm run ops:release-data-publish-handoff -- --ref ${status.ref}`,
    workflowDispatchDryRun: status.commands.releaseDispatchDryRun,
    workflowDispatch: status.commands.releaseDispatch,
    releaseTagPush: status.commands.releaseTagPush,
    urlSmokeEnv: [
      `$env:GITHUB_REPOSITORY="${status.repository}"`,
      `$env:PARKKING_RELEASE_ID="${status.release.releaseId}"`,
      `$env:PARKKING_RELEASE_TAG="${status.release.tag}"`,
    ],
    urlSmoke: 'npm run ops:release-data-url-smoke',
    renderEnv: renderEnvAssignments(
      buildRenderDeploymentEnv({
        packageUrl: status.release.packageUrl,
        manifestUrl: status.release.manifestUrl,
      }),
    ),
    renderEnvSyncServiceIdDryRun: status.commands.renderEnvSyncServiceIdDryRun,
    renderEnvSyncServiceIdApply: status.commands.renderEnvSyncServiceIdApply,
    renderEnvSyncServiceNameDryRun: status.commands.renderEnvSyncDryRun,
    renderEnvSyncServiceNameApply: status.commands.renderEnvSyncApply,
    renderEnvSyncDispatchDryRun: status.commands.renderEnvSyncDispatchDryRun,
    renderEnvSyncDispatch: status.commands.renderEnvSyncDispatch,
    renderLiveVerifyDryRun: status.commands.renderLiveVerifyDryRun,
    renderLiveVerify: status.commands.renderLiveVerify,
    localRenderVerify: `npm run ops:render-deployment-verify -- --app-url ${quoteCommandValue(
      appUrl,
    )} --manifest-url ${status.release.manifestUrl}`,
  }
}

const hashFile = async (filePath: string) => {
  const content = await fs.readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

const assetUrlForName = (status: ReleaseHandoffStatusResult, name: string) =>
  name.endsWith('.zip') ? status.release.packageUrl : status.release.manifestUrl

const githubUrl = (repository: string, pathPart: string) =>
  `https://github.com/${repository}/${pathPart}`

const buildManualPublish = (
  status: ReleaseHandoffStatusResult,
  assets: ReleasePublishRequestAsset[],
): ReleasePublishRequestManualPublish => ({
  githubNewReleaseUrl: githubUrl(status.repository, 'releases/new'),
  expectedReleaseUrl: githubUrl(
    status.repository,
    `releases/tag/${encodeURIComponent(status.release.tag)}`,
  ),
  releaseTag: status.release.tag,
  releaseTitle: `ParkKing data ${status.release.releaseId}`,
  assetDirectory: assets[0] ? path.dirname(assets[0].path) : null,
  uploadAssetPaths: assets.map((asset) => asset.path),
})

const buildAssets = async (
  status: ReleaseHandoffStatusResult,
  publishPlan: PublishReleaseDataFromHandoffPlan | null,
): Promise<ReleasePublishRequestAsset[]> => {
  const assetPaths = publishPlan?.assetPaths ?? []
  return Promise.all(
    assetPaths.map(async (assetPath) => {
      const stat = await fs.stat(assetPath)
      const name = path.basename(assetPath)
      return {
        name,
        path: path.resolve(assetPath),
        sizeBytes: stat.size,
        sha256: await hashFile(assetPath),
        expectedUrl: assetUrlForName(status, name),
      }
    }),
  )
}

const buildState = (
  status: ReleaseHandoffStatusResult,
  blockers: string[],
): ReleasePublishRequestResult['state'] => {
  if (status.readyForRenderLiveVerify) {
    return 'ready_for_render_live_verify'
  }
  if (blockers.length > 0 || !status.readyForReleasePublish) {
    return 'blocked'
  }
  if (status.releaseLookup.published === true) {
    return 'release_published_needs_render'
  }
  return 'ready_for_release_publish'
}

const buildExternalRequirements = (
  status: ReleaseHandoffStatusResult,
  environment: ReleasePublishRequestEnvironment,
) => {
  const requirements: string[] = []
  if (status.releaseLookup.published !== true) {
    requirements.push(
      `Publish GitHub Release ${status.release.tag} with the local handoff assets, push the matching data tag, or run the Release Data Package workflow.`,
    )
    if (
      !environment.ghTokenPresent &&
      !environment.githubTokenPresent &&
      !environment.ghCliAvailable
    ) {
      requirements.push(
        'Provide GH_TOKEN/GITHUB_TOKEN with contents:write, install/authenticate gh, push the matching data tag, or run the GitHub Actions workflow from the GitHub UI.',
      )
    }
  }
  if (status.publishedManifest.pass === false) {
    requirements.push(
      'Resolve published release manifest drift before Render verification: use the matching workflow handoff artifact or republish the local handoff assets after confirming data source drift.',
    )
  }
  requirements.push(
    `Set Render environment from the Render Environment block, including published release asset URLs and runtime hardening values (${Object.keys(
      REQUIRED_RENDER_RUNTIME_ENV,
    ).join(', ')}).`,
  )
  requirements.push('Deploy the Render Blueprint after release assets are reachable.')
  if (!status.appUrl) {
    requirements.push('Provide the live Render service URL for final verification.')
  }
  if (!environment.renderServiceIdPresent) {
    requirements.push(
      'Provide PARKKING_RENDER_SERVICE_ID/RENDER_SERVICE_ID for service-id env sync commands, or use RENDER_API_KEY with service-name resolution.',
    )
  }
  if (!environment.renderApiKeyPresent && !environment.renderCliAvailable) {
    requirements.push(
      'Use the Render dashboard or provide Render CLI/API credentials for deployment.',
    )
  }
  return uniqueLines(requirements)
}

const buildPublishPlan = async (
  options: ReleasePublishRequestOptions,
  status: ReleaseHandoffStatusResult,
) =>
  buildPublishReleaseDataFromHandoffPlan({
    handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON,
    ref: status.ref,
    targetSha: status.targetSha,
    releaseDir: options.releaseDir ?? DEFAULT_RELEASE_DIR,
    readinessMarkdownPath: options.readinessMarkdownPath ?? DEFAULT_READINESS_MD,
    latest: false,
    dryRun: true,
    smokeUrls: true,
    allowShaMismatch: false,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    token: options.token,
  })

export const buildReleasePublishRequest = async (
  options: ReleasePublishRequestOptions = {},
  fetchImpl: FetchImpl = fetch,
  environment: ReleasePublishRequestEnvironment = detectReleasePublishRequestEnvironment(),
): Promise<ReleasePublishRequestResult> => {
  const statusOptions: ReleaseHandoffStatusOptions = {
    handoffJsonPath: options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON,
    readinessJsonPath: options.readinessJsonPath ?? DEFAULT_READINESS_JSON,
    repository: options.repository,
    ref: options.ref,
    targetSha: options.targetSha,
    appUrl: options.appUrl,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    skipReleaseLookup: options.skipReleaseLookup,
  }
  const status = await buildReleaseHandoffStatus(statusOptions, fetchImpl)
  let publishPlan: PublishReleaseDataFromHandoffPlan | null = null
  const blockers = [...localBlockersFromStatus(status)]
  const warnings = [...status.warnings]

  if (status.release.localAssetsPresent) {
    try {
      publishPlan = await buildPublishPlan(options, status)
      blockers.push(
        ...publishPlan.blockers.filter(
          (blocker) =>
            !blockers.includes(blocker) &&
            !blocker.startsWith('Missing GH_TOKEN or GITHUB_TOKEN'),
        ),
      )
    } catch (error) {
      blockers.push(
        `Could not build exact handoff publish plan: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  const assets = await buildAssets(status, publishPlan)
  const manualPublish = buildManualPublish(status, assets)
  const commands = buildCommands(status)
  const externalRequirements = buildExternalRequirements(status, environment)

  return {
    state: buildState(status, blockers),
    status,
    publishPlan,
    environment,
    assets,
    manualPublish,
    commands,
    blockers,
    externalRequirements,
    warnings,
  }
}

const formatBool = (value: boolean) => (value ? 'yes' : 'no')

const formatAssetRows = (assets: ReleasePublishRequestAsset[]) =>
  assets.length > 0
    ? assets.map(
        (asset) =>
          `| ${asset.name} | ${asset.sizeBytes} | ${asset.sha256} | ${asset.path} | ${asset.expectedUrl} |`,
      )
    : ['| none | 0 | - | - | - |']

const commandBlock = (commands: string[]) => [
  '```powershell',
  ...commands,
  '```',
]

export const renderReleasePublishRequest = (
  result: ReleasePublishRequestResult,
) =>
  [
    `# Release Publish Request: ${result.state.toUpperCase()}`,
    '',
    '## Release',
    '',
    `- Repository: ${result.status.repository}`,
    `- Ref: ${result.status.ref}`,
    `- Target SHA: ${result.status.targetSha ?? '-'}`,
    `- Release ID: ${result.status.release.releaseId}`,
    `- Release tag: ${result.status.release.tag}`,
    `- GitHub Release published: ${
      result.status.releaseLookup.published === null
        ? 'unknown'
        : formatBool(result.status.releaseLookup.published)
    }`,
    `- Published manifest parity: ${
      result.status.publishedManifest.pass === null
        ? 'unknown'
        : formatBool(result.status.publishedManifest.pass)
    }`,
    `- Ready for release publish: ${formatBool(result.status.readyForReleasePublish)}`,
    `- Ready for Render live verify: ${formatBool(result.status.readyForRenderLiveVerify)}`,
    '',
    '## Local Assets',
    '',
    '| Asset | Bytes | SHA-256 | Local path | Expected URL |',
    '| --- | ---: | --- | --- | --- |',
    ...formatAssetRows(result.assets),
    '',
    '## Manual GitHub UI Publish',
    '',
    `- Open: ${result.manualPublish.githubNewReleaseUrl}`,
    `- Tag: ${result.manualPublish.releaseTag}`,
    `- Title: ${result.manualPublish.releaseTitle}`,
    `- Upload asset directory: ${result.manualPublish.assetDirectory ?? '-'}`,
    ...(result.manualPublish.uploadAssetPaths.length > 0
      ? result.manualPublish.uploadAssetPaths.map(
          (assetPath) => `- Upload file: ${assetPath}`,
        )
      : ['- Upload file: none']),
    `- Expected release page after publish: ${result.manualPublish.expectedReleaseUrl}`,
    '- After publishing, run the URL smoke commands below before assigning Render env vars.',
    '',
    '## Environment',
    '',
    `- GH_TOKEN present: ${formatBool(result.environment.ghTokenPresent)}`,
    `- GITHUB_TOKEN present: ${formatBool(result.environment.githubTokenPresent)}`,
    `- GITHUB_REPOSITORY: ${result.environment.githubRepository ?? '-'}`,
    `- gh CLI available: ${formatBool(result.environment.ghCliAvailable)}`,
    `- PARKKING_RENDER_SERVICE_ID/RENDER_SERVICE_ID present: ${formatBool(
      result.environment.renderServiceIdPresent,
    )}`,
    `- RENDER_API_KEY present: ${formatBool(result.environment.renderApiKeyPresent)}`,
    `- Render CLI available: ${formatBool(result.environment.renderCliAvailable)}`,
    '',
    '## Exact Local Publish',
    '',
    ...commandBlock([
      '$env:GH_TOKEN="<token with contents:write>"',
      result.commands.exactLocalPublishDryRun,
      result.commands.exactLocalPublish,
    ]),
    '',
    '## Workflow Publish Alternative',
    '',
    'This workflow may generate a fresh release ID; use the workflow output URLs if you choose this path.',
    '',
    ...commandBlock([
      '$env:GH_TOKEN="<token with workflow dispatch access>"',
      result.commands.workflowDispatchDryRun,
      result.commands.workflowDispatch,
    ]),
    '',
    '## Tag Push Publish Alternative',
    '',
    'This pushes the existing handoff tag so GitHub Actions publishes assets with the same release ID.',
    '',
    ...commandBlock([result.commands.releaseTagPush]),
    '',
    '## URL Smoke After Publish',
    '',
    ...commandBlock([...result.commands.urlSmokeEnv, result.commands.urlSmoke]),
    '',
    '## Render Environment',
    '',
    '```text',
    ...result.commands.renderEnv,
    '```',
    '',
    '## Render Env Sync',
    '',
    'Use the service-id dry-run first when the Render service ID is known; it does not require a Render token. Applying changes requires Render API credentials, and the workflow path requires the repository `RENDER_API_KEY` secret.',
    '',
    ...commandBlock([
      '# Service ID path',
      result.commands.renderEnvSyncServiceIdDryRun,
      '$env:RENDER_API_KEY="<Render API key>"',
      result.commands.renderEnvSyncServiceIdApply,
      '# Service name path; requires RENDER_API_KEY even for dry-run',
      result.commands.renderEnvSyncServiceNameDryRun,
      result.commands.renderEnvSyncServiceNameApply,
      '# GitHub Actions path',
      '$env:GH_TOKEN="<token with workflow dispatch access>"',
      result.commands.renderEnvSyncDispatchDryRun,
      result.commands.renderEnvSyncDispatch,
    ]),
    '',
    '## Render Verification',
    '',
    ...commandBlock([
      result.commands.renderLiveVerifyDryRun,
      result.commands.renderLiveVerify,
      result.commands.localRenderVerify,
    ]),
    '',
    '## External Requirements',
    '',
    ...(result.externalRequirements.length > 0
      ? result.externalRequirements.map((requirement) => `- ${requirement}`)
      : ['- none']),
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

export const writeReleasePublishRequestOutputs = async (
  result: ReleasePublishRequestResult,
  options: Pick<ReleasePublishRequestOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${renderReleasePublishRequest(result)}\n`, 'utf-8')
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
        'Usage: tsx scripts/ops/releasePublishRequest.ts [options]',
        '',
        'Options:',
        '  --handoff-json <path>       Defaults to .tmp/render-deployment-handoff.json',
        '  --readiness-json <path>     Defaults to .tmp/release-handoff-readiness.json',
        '  --readiness-md <path>       Defaults to .tmp/p3-release-readiness.md',
        '  --release-dir <path>        Defaults to dist/releases',
        '  --repo <owner/name>         Overrides repository for release status lookup',
        '  --ref <branch>              Defaults to current status resolver',
        '  --target-sha <sha>          Override git rev-parse <ref>',
        '  --app-url <url>             Render service URL for verification commands',
        '  --skip-release-lookup       Do not query GitHub Release status',
        '  --token-env <name>          Token env var; defaults to GH_TOKEN then GITHUB_TOKEN',
        '  --out <path>                Defaults to .tmp/release-publish-request.md',
        '  --json-out <path>           Defaults to .tmp/release-publish-request.json',
      ].join('\n'),
    )
    return
  }

  const options = parseReleasePublishRequestArgs(argv)
  const result = await buildReleasePublishRequest(options)
  await writeReleasePublishRequestOutputs(result, options)
  console.log(renderReleasePublishRequest(result))
  if (result.state === 'blocked') {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
