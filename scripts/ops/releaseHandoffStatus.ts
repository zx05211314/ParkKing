import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getArgValue,
  hasFlag,
  normalizeGithubRepository,
  resolveCurrentGitBranch,
  validateHttpUrl,
} from './githubWorkflowDispatch'
import type { RenderDeploymentHandoffResult } from './renderDeploymentHandoff'
import type { ReleaseHandoffReadinessResult } from './releaseHandoffReadiness'

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_READINESS_JSON = '.tmp/release-handoff-readiness.json'
const DEFAULT_OUT_PATH = '.tmp/release-handoff-status.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/release-handoff-status.json'
const DEFAULT_TIMEOUT_MS = 15000

type ReleaseLookupFetch = typeof fetch

interface GitHubReleaseResponse {
  html_url?: unknown
  tag_name?: unknown
}

export interface ReleaseHandoffStatusOptions {
  handoffJsonPath?: string | null
  readinessJsonPath?: string | null
  repository?: string | null
  ref?: string | null
  appUrl?: string | null
  timeoutMs?: number | null
  skipReleaseLookup?: boolean | null
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface ReleaseHandoffReleaseLookup {
  checked: boolean
  url: string | null
  published: boolean | null
  status: number | null
  htmlUrl: string | null
  error: string | null
}

export interface ReleaseHandoffStatusCommands {
  localHandoff: string
  releaseDispatchDryRun: string
  releaseDispatch: string
  renderLiveVerifyDryRun: string
  renderLiveVerify: string
}

export interface ReleaseHandoffStatusResult {
  readyForReleasePublish: boolean
  readyForRenderLiveVerify: boolean
  handoffReady: boolean
  readinessPass: boolean | null
  repository: string
  ref: string
  appUrl: string | null
  release: {
    releaseId: string
    tag: string
    packageUrl: string
    manifestUrl: string
  }
  releaseLookup: ReleaseHandoffReleaseLookup
  commands: ReleaseHandoffStatusCommands
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

export const parseReleaseHandoffStatusArgs = (
  argv: string[],
): ReleaseHandoffStatusOptions => ({
  handoffJsonPath:
    getArgValue(argv, '--handoff-json', '--handoffJson') ?? DEFAULT_HANDOFF_JSON,
  readinessJsonPath:
    getArgValue(argv, '--readiness-json', '--readinessJson') ??
    DEFAULT_READINESS_JSON,
  repository: getArgValue(argv, '--repo', '--repository'),
  ref: getArgValue(argv, '--ref'),
  appUrl: getArgValue(argv, '--app-url', '--appUrl'),
  timeoutMs:
    parsePositiveInteger(getArgValue(argv, '--timeout-ms', '--timeoutMs'), 'timeout-ms') ??
    DEFAULT_TIMEOUT_MS,
  skipReleaseLookup: hasFlag(argv, '--skip-release-lookup'),
  outPath: getArgValue(argv, '--out') ?? DEFAULT_OUT_PATH,
  jsonOutPath:
    getArgValue(argv, '--json-out', '--jsonOut') ?? DEFAULT_JSON_OUT_PATH,
})

const readJsonFile = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const readOptionalJsonFile = async <T>(filePath: string) => {
  try {
    return await readJsonFile<T>(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

const requireString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`)
  }
  return value
}

const resolveRepository = (
  options: ReleaseHandoffStatusOptions,
  handoff: RenderDeploymentHandoffResult,
) => {
  const repository =
    normalizeGithubRepository(options.repository) ??
    normalizeGithubRepository(process.env.GITHUB_REPOSITORY) ??
    normalizeGithubRepository(handoff.repository)
  if (!repository) {
    throw new Error(
      'Missing --repo owner/name, GITHUB_REPOSITORY, or repository in handoff JSON',
    )
  }
  return repository
}

const resolveRef = (options: ReleaseHandoffStatusOptions) =>
  options.ref ??
  process.env.GITHUB_REF_NAME ??
  resolveCurrentGitBranch() ??
  'main'

const resolveAppUrl = (options: ReleaseHandoffStatusOptions) => {
  const appUrl = options.appUrl ?? process.env.PARKKING_RENDER_APP_URL ?? null
  if (appUrl) {
    validateHttpUrl(appUrl, '--app-url')
  }
  return appUrl
}

const releaseLookupUrl = (repository: string, tag: string) =>
  `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`

const lookupGitHubRelease = async (
  params: {
    repository: string
    tag: string
    timeoutMs: number
    skip: boolean
  },
  fetchImpl: ReleaseLookupFetch,
): Promise<ReleaseHandoffReleaseLookup> => {
  const url = releaseLookupUrl(params.repository, params.tag)
  if (params.skip) {
    return {
      checked: false,
      url,
      published: null,
      status: null,
      htmlUrl: null,
      error: null,
    }
  }

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'ParkKing release handoff status',
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(params.timeoutMs),
    })
    if (response.status === 404) {
      return {
        checked: true,
        url,
        published: false,
        status: response.status,
        htmlUrl: null,
        error: null,
      }
    }
    if (!response.ok) {
      return {
        checked: true,
        url,
        published: null,
        status: response.status,
        htmlUrl: null,
        error: `HTTP ${response.status} ${response.statusText}`,
      }
    }
    const parsed = (await response.json()) as GitHubReleaseResponse
    return {
      checked: true,
      url,
      published: true,
      status: response.status,
      htmlUrl: typeof parsed.html_url === 'string' ? parsed.html_url : null,
      error: null,
    }
  } catch (error) {
    return {
      checked: true,
      url,
      published: null,
      status: null,
      htmlUrl: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const quoteCommandValue = (value: string) =>
  /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value

const buildCommands = (params: {
  repository: string
  ref: string
  manifestUrl: string
  appUrl: string | null
}): ReleaseHandoffStatusCommands => {
  const appUrl = params.appUrl ?? '<Render service URL>'
  return {
    localHandoff: 'npm run ops:release-handoff-readiness',
    releaseDispatchDryRun: `npm run ops:release-data-dispatch -- --repo ${params.repository} --ref ${params.ref} --dry-run`,
    releaseDispatch: `npm run ops:release-data-dispatch -- --repo ${params.repository} --ref ${params.ref}`,
    renderLiveVerifyDryRun: `npm run ops:render-live-verify-dispatch -- --repo ${params.repository} --ref ${params.ref} --app-url ${quoteCommandValue(appUrl)} --manifest-url ${params.manifestUrl} --dry-run`,
    renderLiveVerify: `npm run ops:render-live-verify-dispatch -- --repo ${params.repository} --ref ${params.ref} --app-url ${quoteCommandValue(appUrl)} --manifest-url ${params.manifestUrl}`,
  }
}

const buildStatusText = (value: boolean | null) =>
  value === true ? 'yes' : value === false ? 'no' : 'unknown'

export const buildReleaseHandoffStatus = async (
  options: ReleaseHandoffStatusOptions = {},
  fetchImpl: ReleaseLookupFetch = fetch,
): Promise<ReleaseHandoffStatusResult> => {
  const handoffPath = options.handoffJsonPath ?? DEFAULT_HANDOFF_JSON
  const readinessPath = options.readinessJsonPath ?? DEFAULT_READINESS_JSON
  const [handoff, readiness] = await Promise.all([
    readJsonFile<RenderDeploymentHandoffResult>(handoffPath),
    readOptionalJsonFile<ReleaseHandoffReadinessResult>(readinessPath),
  ])
  const repository = resolveRepository(options, handoff)
  const ref = resolveRef(options)
  const appUrl = resolveAppUrl(options)
  const releaseId = requireString(handoff.release?.releaseId, 'handoff.release.releaseId')
  const tag = requireString(handoff.release?.tag, 'handoff.release.tag')
  const packageUrl = requireString(handoff.packageUrl, 'handoff.packageUrl')
  const manifestUrl = requireString(handoff.manifestUrl, 'handoff.manifestUrl')
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const releaseLookup = await lookupGitHubRelease(
    {
      repository,
      tag,
      timeoutMs,
      skip: Boolean(options.skipReleaseLookup),
    },
    fetchImpl,
  )
  const handoffReady = handoff.ready === true
  const readinessPass = readiness ? readiness.pass === true : null
  const commands = buildCommands({ repository, ref, manifestUrl, appUrl })
  const blockers: string[] = []
  const warnings: string[] = []

  if (!handoffReady) {
    blockers.push('Local Render deployment handoff is not READY')
  }
  if (readinessPass === false) {
    blockers.push('Local release handoff readiness runner did not pass')
  }
  if (readinessPass === null) {
    warnings.push(
      `${readinessPath} is missing; run ${commands.localHandoff} for full sequential gate output`,
    )
  }
  if (releaseLookup.published === false) {
    blockers.push(`GitHub Release ${tag} is not published yet`)
  }
  if (releaseLookup.published === null && releaseLookup.checked) {
    warnings.push(
      `Could not determine GitHub Release status for ${tag}: ${releaseLookup.error ?? 'unknown error'}`,
    )
  }
  if (!appUrl) {
    warnings.push('Render app URL is not set; pass --app-url or PARKKING_RENDER_APP_URL before live verify')
  }

  const readyForReleasePublish = handoffReady && readinessPass !== false
  const readyForRenderLiveVerify =
    readyForReleasePublish && releaseLookup.published === true && Boolean(appUrl)
  const nextActions =
    !readyForReleasePublish
      ? [`Run local handoff gate: ${commands.localHandoff}`]
      : releaseLookup.published !== true
        ? [
            'Publish GitHub Release assets with GitHub Actions -> Release Data Package.',
            `Preview dispatch payload: ${commands.releaseDispatchDryRun}`,
            `Dispatch with token: ${commands.releaseDispatch}`,
          ]
        : !appUrl
          ? [
              'Set Render env vars from the handoff and deploy Render.',
              'Set PARKKING_RENDER_APP_URL or pass --app-url for live verification.',
            ]
          : [
              `Preview Render live verify: ${commands.renderLiveVerifyDryRun}`,
              `Dispatch Render live verify with token: ${commands.renderLiveVerify}`,
            ]

  return {
    readyForReleasePublish,
    readyForRenderLiveVerify,
    handoffReady,
    readinessPass,
    repository,
    ref,
    appUrl,
    release: {
      releaseId,
      tag,
      packageUrl,
      manifestUrl,
    },
    releaseLookup,
    commands,
    nextActions,
    blockers,
    warnings,
  }
}

export const renderReleaseHandoffStatus = (
  result: ReleaseHandoffStatusResult,
) =>
  [
    `# Release Handoff Status: ${
      result.readyForRenderLiveVerify
        ? 'READY FOR LIVE VERIFY'
        : result.readyForReleasePublish
          ? 'READY FOR RELEASE PUBLISH'
          : 'BLOCKED'
    }`,
    '',
    '## Release',
    '',
    `- Repository: ${result.repository}`,
    `- Ref: ${result.ref}`,
    `- Release ID: ${result.release.releaseId}`,
    `- Release tag: ${result.release.tag}`,
    `- Package URL: ${result.release.packageUrl}`,
    `- Manifest URL: ${result.release.manifestUrl}`,
    '',
    '## Status',
    '',
    `- Local handoff ready: ${buildStatusText(result.handoffReady)}`,
    `- Sequential runner passed: ${buildStatusText(result.readinessPass)}`,
    `- GitHub Release published: ${buildStatusText(result.releaseLookup.published)}`,
    `- Render app URL: ${result.appUrl ?? '-'}`,
    `- Ready for release publish: ${buildStatusText(result.readyForReleasePublish)}`,
    `- Ready for Render live verify: ${buildStatusText(result.readyForRenderLiveVerify)}`,
    '',
    '## Commands',
    '',
    `- Local handoff: ${result.commands.localHandoff}`,
    `- Release dispatch dry-run: ${result.commands.releaseDispatchDryRun}`,
    `- Release dispatch: ${result.commands.releaseDispatch}`,
    `- Render live verify dry-run: ${result.commands.renderLiveVerifyDryRun}`,
    `- Render live verify: ${result.commands.renderLiveVerify}`,
    '',
    '## Next Actions',
    '',
    ...result.nextActions.map((action) => `- ${action}`),
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

export const writeReleaseHandoffStatusOutputs = async (
  result: ReleaseHandoffStatusResult,
  options: Pick<ReleaseHandoffStatusOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${renderReleaseHandoffStatus(result)}\n`, 'utf-8')
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
        'Usage: tsx scripts/ops/releaseHandoffStatus.ts [options]',
        '',
        'Options:',
        '  --handoff-json <path>       Defaults to .tmp/render-deployment-handoff.json',
        '  --readiness-json <path>     Defaults to .tmp/release-handoff-readiness.json',
        '  --repo <owner/name>         Defaults to GITHUB_REPOSITORY or handoff JSON repository',
        '  --ref <branch>              Defaults to GITHUB_REF_NAME, current branch, or main',
        '  --app-url <url>             Render service URL for live verify command rendering',
        '  --skip-release-lookup       Do not query GitHub Release status',
        '  --out <path>                Defaults to .tmp/release-handoff-status.md',
        '  --json-out <path>           Defaults to .tmp/release-handoff-status.json',
      ].join('\n'),
    )
    return
  }

  const options = parseReleaseHandoffStatusArgs(argv)
  const result = await buildReleaseHandoffStatus(options)
  await writeReleaseHandoffStatusOutputs(result, options)
  console.log(renderReleaseHandoffStatus(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
