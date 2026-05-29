import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  buildReleaseDataUrls,
  resolveReleaseDataMetadata,
  type ReleaseDataMetadata,
} from './releaseDataWorkflow'

const DEFAULT_P3_READINESS_JSON = '.tmp/p3-release-readiness.json'
const DEFAULT_DEPLOY_READINESS_JSON = '.tmp/deploy-readiness.json'

interface P3ReadinessJson {
  pass?: unknown
  inputs?: {
    districtIds?: unknown
  }
  releasePackage?: {
    summary?: {
      releaseId?: unknown
      districtIds?: unknown
      fileCount?: unknown
      totalBytes?: unknown
    }
  }
}

interface DeployReadinessJson {
  pass?: unknown
  release?: {
    releaseId?: unknown
    zipPath?: unknown
    manifestPath?: unknown
  }
  install?: {
    result?: {
      registryDistrictIds?: unknown
      fileCount?: unknown
    } | null
  }
  parkingAnswerApis?: {
    pass?: unknown
  }
  appServer?: {
    pass?: unknown
  }
}

export interface RenderDeploymentHandoffOptions {
  p3ReadinessJsonPath?: string | null
  deployReadinessJsonPath?: string | null
  repository?: string | null
  tagInput?: string | null
  outPath?: string | null
  jsonOutPath?: string | null
}

export interface RenderDeploymentHandoffResult {
  ready: boolean
  repository: string
  release: ReleaseDataMetadata
  packageUrl: string
  manifestUrl: string
  p3ReadinessPass: boolean
  deployReadinessPass: boolean
  districts: string[]
  releaseFileCount: number | null
  releaseTotalBytes: number | null
  installedFileCount: number | null
  releaseAssetPaths: string[]
  blockers: string[]
  renderEnv: Record<string, string>
  externalSteps: string[]
}

const getArgValue = (argv: string[], ...flags: string[]) => {
  for (const flag of flags) {
    const index = argv.indexOf(flag)
    if (index >= 0) {
      return argv[index + 1] ?? null
    }
  }
  return null
}

export const parseRenderDeploymentHandoffArgs = (
  argv: string[],
): RenderDeploymentHandoffOptions => ({
  p3ReadinessJsonPath:
    getArgValue(argv, '--p3-json', '--p3Json', '--readiness-json') ??
    DEFAULT_P3_READINESS_JSON,
  deployReadinessJsonPath:
    getArgValue(argv, '--deploy-json', '--deployJson') ??
    DEFAULT_DEPLOY_READINESS_JSON,
  repository:
    getArgValue(argv, '--repository', '--repo') ??
    process.env.GITHUB_REPOSITORY ??
    process.env.PARKKING_RELEASE_REPOSITORY ??
    null,
  tagInput:
    getArgValue(argv, '--tag') ?? process.env.PARKKING_RELEASE_TAG_INPUT ?? null,
  outPath: getArgValue(argv, '--out'),
  jsonOutPath: getArgValue(argv, '--json-out', '--jsonOut'),
})

const readJsonFile = async <T>(filePath: string) =>
  JSON.parse(await fs.readFile(filePath, 'utf-8')) as T

const toStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []

const toNumberOrNull = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const normalizeRepository = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }
  const httpsMatch = trimmed.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/)
  if (httpsMatch) {
    return httpsMatch[1]
  }
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/)
  if (sshMatch) {
    return sshMatch[1]
  }
  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
    return trimmed.replace(/\.git$/, '')
  }
  return null
}

export const discoverGitHubRepository = () => {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf-8',
  })
  if (result.status !== 0) {
    return null
  }
  return normalizeRepository(result.stdout)
}

const getRepository = (explicit: string | null | undefined) => {
  const normalized = normalizeRepository(explicit)
  if (normalized) {
    return normalized
  }
  const discovered = discoverGitHubRepository()
  if (discovered) {
    return discovered
  }
  throw new Error('Repository is required. Pass --repository owner/repo.')
}

export const buildRenderDeploymentHandoff = async (
  options: RenderDeploymentHandoffOptions = {},
): Promise<RenderDeploymentHandoffResult> => {
  const p3ReadinessJsonPath =
    options.p3ReadinessJsonPath ?? DEFAULT_P3_READINESS_JSON
  const deployReadinessJsonPath =
    options.deployReadinessJsonPath ?? DEFAULT_DEPLOY_READINESS_JSON
  const [p3, deploy, release] = await Promise.all([
    readJsonFile<P3ReadinessJson>(p3ReadinessJsonPath),
    readJsonFile<DeployReadinessJson>(deployReadinessJsonPath),
    resolveReleaseDataMetadata({
      readinessJsonPath: p3ReadinessJsonPath,
      tagInput: options.tagInput,
    }),
  ])
  const repository = getRepository(options.repository)
  const urls = buildReleaseDataUrls({
    repository,
    tag: release.tag,
    releaseId: release.releaseId,
  })
  const p3Release = p3.releasePackage?.summary
  const deployReleaseId =
    typeof deploy.release?.releaseId === 'string' ? deploy.release.releaseId : null
  const releaseAssetPaths = [
    typeof deploy.release?.zipPath === 'string' ? deploy.release.zipPath : null,
    typeof deploy.release?.manifestPath === 'string'
      ? deploy.release.manifestPath
      : null,
  ].filter((filePath): filePath is string => Boolean(filePath))
  const p3ReadinessPass = p3.pass === true
  const deployReadinessPass = deploy.pass === true
  const blockers: string[] = []

  if (!p3ReadinessPass) {
    blockers.push(`${p3ReadinessJsonPath} is not passing`)
  }
  if (!deployReadinessPass) {
    blockers.push(`${deployReadinessJsonPath} is not passing`)
  }
  if (deployReleaseId && deployReleaseId !== release.releaseId) {
    blockers.push(
      `Deploy readiness release ${deployReleaseId} does not match P3 release ${release.releaseId}`,
    )
  }
  if (deploy.parkingAnswerApis?.pass !== true) {
    blockers.push('Deploy readiness parking-answer API smoke is not passing')
  }
  if (deploy.appServer?.pass !== true) {
    blockers.push('Deploy readiness app server smoke is not passing')
  }
  if (releaseAssetPaths.length === 0) {
    blockers.push(
      'Deploy readiness did not record release zip/manifest paths; rerun npm run ops:deploy-readiness',
    )
  }
  const missingReleaseAssets = (
    await Promise.all(
      releaseAssetPaths.map(async (filePath) => ({
        filePath,
        exists: await fileExists(filePath),
      })),
    )
  )
    .filter((entry) => !entry.exists)
    .map((entry) => entry.filePath)
  if (missingReleaseAssets.length > 0) {
    blockers.push(
      `Release assets are missing locally: ${missingReleaseAssets.join(', ')}. Run npm run ops:p3-release-readiness after npm run build, then rerun npm run ops:deploy-readiness.`,
    )
  }

  const districts =
    toStringArray(p3Release?.districtIds).length > 0
      ? toStringArray(p3Release?.districtIds)
      : toStringArray(p3.inputs?.districtIds)

  return {
    ready: blockers.length === 0,
    repository,
    release,
    packageUrl: urls.packageUrl,
    manifestUrl: urls.manifestUrl,
    p3ReadinessPass,
    deployReadinessPass,
    districts,
    releaseFileCount: toNumberOrNull(p3Release?.fileCount),
    releaseTotalBytes: toNumberOrNull(p3Release?.totalBytes),
    installedFileCount: toNumberOrNull(deploy.install?.result?.fileCount),
    releaseAssetPaths,
    blockers,
    renderEnv: {
      PARKKING_RELEASE_PACKAGE_URL: urls.packageUrl,
      PARKKING_RELEASE_MANIFEST_URL: urls.manifestUrl,
    },
    externalSteps: [
      'Merge or deploy the branch that contains the release workflow and render.yaml changes.',
      'Run GitHub Actions -> Release Data Package with configsGlob=configs/prod/*.json.',
      `Use release tag ${release.tag}; leave tag blank in the workflow to use this default.`,
      'Set the Render environment variables shown below, plus a download token/header if the repository is private.',
      'Deploy the Render Blueprint and verify /api/parking-answer/ready returns status ok.',
    ],
  }
}

export const renderRenderDeploymentHandoff = (
  result: RenderDeploymentHandoffResult,
) => {
  const lines = [
    `# Render Deployment Handoff: ${result.ready ? 'READY' : 'BLOCKED'}`,
    '',
    '## Release',
    '',
    `- Repository: ${result.repository}`,
    `- Release ID: ${result.release.releaseId}`,
    `- Release tag: ${result.release.tag}`,
    `- Districts: ${result.districts.join(', ') || '-'}`,
    `- Release files: ${result.releaseFileCount ?? '-'}`,
    `- Installed files: ${result.installedFileCount ?? '-'}`,
    `- Total bytes: ${result.releaseTotalBytes ?? '-'}`,
    `- Local assets: ${result.releaseAssetPaths.join(', ') || '-'}`,
    '',
    '## Gate Status',
    '',
    `- P3 release readiness: ${result.p3ReadinessPass ? 'pass' : 'blocked'}`,
    `- Deploy readiness: ${result.deployReadinessPass ? 'pass' : 'blocked'}`,
    '',
    '## Render Environment',
    '',
    '```text',
    ...Object.entries(result.renderEnv).map(([key, value]) => `${key}=${value}`),
    '```',
    '',
    '## GitHub Release Asset URLs',
    '',
    `- Package: ${result.packageUrl}`,
    `- Manifest: ${result.manifestUrl}`,
    '',
    '## External Steps',
    '',
    ...result.externalSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Blockers',
    '',
    ...(result.blockers.length > 0
      ? result.blockers.map((blocker) => `- ${blocker}`)
      : ['- none']),
  ]
  return `${lines.join('\n')}\n`
}

export const writeRenderDeploymentHandoffOutputs = async (
  result: RenderDeploymentHandoffResult,
  options: Pick<RenderDeploymentHandoffOptions, 'outPath' | 'jsonOutPath'>,
) => {
  if (options.outPath) {
    const resolved = path.resolve(options.outPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, renderRenderDeploymentHandoff(result), 'utf-8')
  }
  if (options.jsonOutPath) {
    const resolved = path.resolve(options.jsonOutPath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf-8')
  }
}

const run = async () => {
  const options = parseRenderDeploymentHandoffArgs(process.argv)
  const result = await buildRenderDeploymentHandoff(options)
  await writeRenderDeploymentHandoffOutputs(result, options)
  console.log(renderRenderDeploymentHandoff(result))
  if (!result.ready) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
