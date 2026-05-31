import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  getArgValue,
  hasFlag,
  normalizeGithubRepository,
  parseBooleanArg,
  resolveWorkflowDispatchToken,
} from './githubWorkflowDispatch'
import {
  publishReleaseDataAssets,
  renderReleaseDataAssetUrlSmokeResult,
  smokeReleaseDataAssetUrls,
} from './releaseDataWorkflow'
import type { RenderDeploymentHandoffResult } from './renderDeploymentHandoff'

const DEFAULT_HANDOFF_JSON = '.tmp/render-deployment-handoff.json'
const DEFAULT_RELEASE_DIR = 'dist/releases'
const DEFAULT_READINESS_MD = '.tmp/p3-release-readiness.md'
const DEFAULT_REF = 'main'
const DEFAULT_TIMEOUT_MS = 30000

type FetchImpl = typeof fetch

export interface PublishReleaseDataFromHandoffOptions {
  handoffJsonPath: string
  ref: string
  targetSha?: string | null
  releaseDir: string
  readinessMarkdownPath: string
  latest: boolean
  dryRun: boolean
  smokeUrls: boolean
  allowShaMismatch: boolean
  timeoutMs: number
  token?: string | null
}

export interface PublishReleaseDataFromHandoffPlan {
  repository: string
  ref: string
  targetSha: string
  releaseId: string
  tag: string
  packageUrl: string
  manifestUrl: string
  releaseDir: string
  readinessMarkdownPath: string
  assetPaths: string[]
  latest: boolean
  dryRun: boolean
  smokeUrls: boolean
  tokenPresent: boolean
  blockers: string[]
}

export interface PublishReleaseDataFromHandoffResult {
  plan: PublishReleaseDataFromHandoffPlan
  published: boolean
  smokePass: boolean | null
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

export const parsePublishReleaseDataFromHandoffArgs = (
  argv: string[],
): PublishReleaseDataFromHandoffOptions => ({
  handoffJsonPath: getArgValue(argv, '--handoff-json', '--handoffJson') ?? DEFAULT_HANDOFF_JSON,
  ref: getArgValue(argv, '--ref') ?? DEFAULT_REF,
  targetSha: getArgValue(argv, '--target-sha', '--targetSha'),
  releaseDir: getArgValue(argv, '--release-dir', '--releaseDir') ?? DEFAULT_RELEASE_DIR,
  readinessMarkdownPath:
    getArgValue(argv, '--readiness-md', '--readinessMd') ?? DEFAULT_READINESS_MD,
  latest: parseBooleanArg(argv, '--latest', false),
  dryRun: hasFlag(argv, '--dry-run'),
  smokeUrls: !hasFlag(argv, '--skip-smoke-urls'),
  allowShaMismatch: hasFlag(argv, '--allow-sha-mismatch'),
  timeoutMs:
    parsePositiveInteger(getArgValue(argv, '--timeout-ms', '--timeoutMs'), 'timeout-ms') ??
    DEFAULT_TIMEOUT_MS,
  token: resolveWorkflowDispatchToken(argv),
})

const readJsonFile = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const requireString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`)
  }
  return value
}

const resolveTargetSha = (options: PublishReleaseDataFromHandoffOptions) => {
  if (options.targetSha?.trim()) {
    return options.targetSha.trim()
  }
  const result = spawnSync('git', ['rev-parse', options.ref], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(
      `Unable to resolve target SHA for ${options.ref}: ${result.stderr.trim()}`,
    )
  }
  return result.stdout.trim()
}

const releaseShaSuffix = (releaseId: string) => {
  const match = /_([0-9a-f]{7,40})$/i.exec(releaseId)
  return match?.[1]?.toLowerCase() ?? null
}

const validateTargetSha = (params: {
  releaseId: string
  targetSha: string
  allowShaMismatch: boolean
}) => {
  if (params.allowShaMismatch) {
    return null
  }
  const suffix = releaseShaSuffix(params.releaseId)
  if (!suffix) {
    return null
  }
  if (!params.targetSha.toLowerCase().startsWith(suffix)) {
    return `Target SHA ${params.targetSha} does not match release ID suffix ${suffix}`
  }
  return null
}

const resolveAssetPaths = async (params: {
  handoff: RenderDeploymentHandoffResult
  releaseId: string
  releaseDir: string
}) => {
  const expectedNames = [
    `park-king-data_${params.releaseId}.zip`,
    `release_manifest_${params.releaseId}.json`,
  ]
  const handoffAssetPaths = Array.isArray(params.handoff.releaseAssetPaths)
    ? params.handoff.releaseAssetPaths
    : []
  const candidatePaths =
    handoffAssetPaths.length > 0
      ? handoffAssetPaths
      : expectedNames.map((name) => path.join(params.releaseDir, name))

  const resolved = expectedNames.map((expectedName) => {
    const match = candidatePaths.find(
      (candidatePath) => path.basename(candidatePath) === expectedName,
    )
    if (!match) {
      throw new Error(`Missing release asset ${expectedName} in handoff`)
    }
    return match
  })

  await Promise.all(
    resolved.map(async (assetPath) => {
      const stat = await fs.stat(assetPath)
      if (!stat.isFile()) {
        throw new Error(`Release asset is not a file: ${assetPath}`)
      }
    }),
  )
  return resolved
}

export const buildPublishReleaseDataFromHandoffPlan = async (
  options: PublishReleaseDataFromHandoffOptions,
): Promise<PublishReleaseDataFromHandoffPlan> => {
  const handoff = await readJsonFile<RenderDeploymentHandoffResult>(
    options.handoffJsonPath,
  )
  const repository = normalizeGithubRepository(handoff.repository)
  if (!repository) {
    throw new Error('handoff.repository must be owner/name')
  }
  const releaseId = requireString(handoff.release?.releaseId, 'handoff.release.releaseId')
  const tag = requireString(handoff.release?.tag, 'handoff.release.tag')
  const packageUrl = requireString(handoff.packageUrl, 'handoff.packageUrl')
  const manifestUrl = requireString(handoff.manifestUrl, 'handoff.manifestUrl')
  const targetSha = resolveTargetSha(options)
  const assetPaths = await resolveAssetPaths({
    handoff,
    releaseId,
    releaseDir: options.releaseDir,
  })
  const blockers: string[] = []

  if (!handoff.ready) {
    blockers.push('Render deployment handoff is not READY')
  }
  const shaMismatch = validateTargetSha({
    releaseId,
    targetSha,
    allowShaMismatch: options.allowShaMismatch,
  })
  if (shaMismatch) {
    blockers.push(shaMismatch)
  }
  if (!options.dryRun && !options.token) {
    blockers.push('Missing GH_TOKEN or GITHUB_TOKEN; use --dry-run to preview only')
  }

  return {
    repository,
    ref: options.ref,
    targetSha,
    releaseId,
    tag,
    packageUrl,
    manifestUrl,
    releaseDir: options.releaseDir,
    readinessMarkdownPath: options.readinessMarkdownPath,
    assetPaths,
    latest: options.latest,
    dryRun: options.dryRun,
    smokeUrls: options.smokeUrls,
    tokenPresent: Boolean(options.token),
    blockers,
  }
}

export const renderPublishReleaseDataFromHandoffPlan = (
  plan: PublishReleaseDataFromHandoffPlan,
) =>
  [
    `# Release Data Handoff Publish: ${
      plan.blockers.length > 0 ? 'BLOCKED' : plan.dryRun ? 'DRY RUN' : 'READY'
    }`,
    '',
    `- Repository: ${plan.repository}`,
    `- Ref: ${plan.ref}`,
    `- Target SHA: ${plan.targetSha}`,
    `- Release ID: ${plan.releaseId}`,
    `- Release tag: ${plan.tag}`,
    `- Package URL: ${plan.packageUrl}`,
    `- Manifest URL: ${plan.manifestUrl}`,
    `- Release dir: ${plan.releaseDir}`,
    `- Readiness notes: ${plan.readinessMarkdownPath}`,
    `- Assets: ${plan.assetPaths.map((assetPath) => path.basename(assetPath)).join(', ')}`,
    `- Mark latest: ${plan.latest}`,
    `- Smoke URLs after publish: ${plan.smokeUrls}`,
    `- Token present: ${plan.tokenPresent ? 'yes' : 'no'}`,
    '',
    '## Blockers',
    '',
    ...(plan.blockers.length > 0
      ? plan.blockers.map((blocker) => `- ${blocker}`)
      : ['- none']),
  ].join('\n')

export const publishReleaseDataFromHandoff = async (
  options: PublishReleaseDataFromHandoffOptions,
  fetchImpl: FetchImpl = fetch,
): Promise<PublishReleaseDataFromHandoffResult> => {
  const plan = await buildPublishReleaseDataFromHandoffPlan(options)
  if (plan.blockers.length > 0 || options.dryRun) {
    return {
      plan,
      published: false,
      smokePass: null,
    }
  }

  await publishReleaseDataAssets({
    releaseId: plan.releaseId,
    tag: plan.tag,
    targetSha: plan.targetSha,
    makeLatest: plan.latest,
    repository: plan.repository,
    token: options.token,
    releaseDir: plan.releaseDir,
    assetPaths: plan.assetPaths,
    readinessMarkdownPath: plan.readinessMarkdownPath,
    fetchImpl,
  })

  if (!plan.smokeUrls) {
    return {
      plan,
      published: true,
      smokePass: null,
    }
  }

  const smoke = await smokeReleaseDataAssetUrls({
    releaseId: plan.releaseId,
    packageUrl: plan.packageUrl,
    manifestUrl: plan.manifestUrl,
    downloadToken: options.token,
    timeoutMs: options.timeoutMs,
  })
  console.log(renderReleaseDataAssetUrlSmokeResult(smoke))
  return {
    plan,
    published: true,
    smokePass: smoke.pass,
  }
}

const run = async () => {
  const argv = process.argv.slice(2)
  if (hasFlag(argv, '--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/publishReleaseDataFromHandoff.ts [options]',
        '',
        'Options:',
        '  --handoff-json <path>       Defaults to .tmp/render-deployment-handoff.json',
        '  --ref <branch>              Git ref for release target SHA; defaults to main',
        '  --target-sha <sha>          Override git rev-parse <ref>',
        '  --release-dir <path>        Defaults to dist/releases',
        '  --readiness-md <path>       Defaults to .tmp/p3-release-readiness.md',
        '  --latest [true|false]       Mark release as latest',
        '  --skip-smoke-urls           Do not smoke published package/manifest URLs',
        '  --allow-sha-mismatch        Skip release-id suffix vs target SHA guard',
        '  --token-env <name>          Token env var; defaults to GH_TOKEN then GITHUB_TOKEN',
        '  --dry-run                   Print publish plan without uploading assets',
      ].join('\n'),
    )
    return
  }

  const options = parsePublishReleaseDataFromHandoffArgs(argv)
  const result = await publishReleaseDataFromHandoff(options)
  console.log(renderPublishReleaseDataFromHandoffPlan(result.plan))
  if (result.plan.blockers.length > 0) {
    process.exit(1)
  }
  if (result.smokePass === false) {
    process.exit(1)
  }
  if (result.published) {
    console.log('Release data assets published from handoff.')
  } else {
    console.log('Dry run only; release data assets were not published.')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
