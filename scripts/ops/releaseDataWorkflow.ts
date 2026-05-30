import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const DEFAULT_READINESS_JSON = '.tmp/p3-release-readiness.json'
const DEFAULT_READINESS_MD = '.tmp/p3-release-readiness.md'
const DEFAULT_RELEASE_DIR = 'dist/releases'

interface P3ReleaseReadinessJson {
  releasePackage?: {
    summary?: {
      releaseId?: string
    }
  }
}

export interface ReleaseDataMetadata {
  releaseId: string
  tag: string
}

export interface ReleaseDataAssetUrlSmokeOptions {
  releaseId: string
  packageUrl: string
  manifestUrl: string
  downloadToken?: string | null
  downloadAuthHeader?: string | null
  timeoutMs?: number
}

export interface ReleaseDataAssetUrlSmokeCheck {
  label: string
  url: string
  method: string
  ok: boolean
  status: number | null
  contentLength: string | null
  contentType: string | null
  error: string | null
}

export interface ReleaseDataAssetUrlSmokeResult {
  pass: boolean
  releaseId: string
  packageUrl: string
  manifestUrl: string
  checks: ReleaseDataAssetUrlSmokeCheck[]
  errors: string[]
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

const getMode = (argv: string[]) =>
  getArgValue(argv, '--mode') ?? argv.find((arg) => !arg.startsWith('-')) ?? null

const writeGitHubFileCommand = async (
  filePath: string | undefined,
  lines: string[],
) => {
  if (!filePath) {
    return
  }
  await fs.appendFile(filePath, `${lines.join('\n')}\n`, 'utf-8')
}

export const resolveReleaseDataMetadata = async (params: {
  readinessJsonPath?: string
  tagInput?: string | null
}): Promise<ReleaseDataMetadata> => {
  const readinessJsonPath = params.readinessJsonPath ?? DEFAULT_READINESS_JSON
  const parsed = JSON.parse(
    await fs.readFile(readinessJsonPath, 'utf-8'),
  ) as P3ReleaseReadinessJson
  const releaseId = parsed.releasePackage?.summary?.releaseId
  if (!releaseId) {
    throw new Error(`Missing releasePackage.summary.releaseId in ${readinessJsonPath}`)
  }
  const tagInput = params.tagInput?.trim()
  return {
    releaseId,
    tag: tagInput || `data-${releaseId}`,
  }
}

const listReleaseAssetPaths = async (releaseDir = DEFAULT_RELEASE_DIR) => {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true })
  const assetPaths = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (/^park-king-data_.+\.zip$/.test(entry.name) ||
          /^release_manifest_.+\.json$/.test(entry.name)),
    )
    .map((entry) => path.join(releaseDir, entry.name))
    .sort()

  if (assetPaths.length === 0) {
    throw new Error(`No release assets found in ${releaseDir}`)
  }
  return assetPaths
}

const runGh = (args: string[], options?: { allowFailure?: boolean }) => {
  const result = spawnSync('gh', args, {
    stdio: options?.allowFailure ? 'ignore' : 'inherit',
    env: process.env,
  })
  if (options?.allowFailure) {
    return result.status === 0
  }
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed with exit ${result.status}`)
  }
  return true
}

export const publishReleaseDataAssets = async (params: {
  releaseId: string
  tag: string
  targetSha: string
  makeLatest: boolean
  releaseDir?: string
  readinessMarkdownPath?: string
}) => {
  const assets = await listReleaseAssetPaths(params.releaseDir)
  const releaseExists = runGh(['release', 'view', params.tag], {
    allowFailure: true,
  })
  if (releaseExists) {
    runGh(['release', 'upload', params.tag, ...assets, '--clobber'])
    if (params.makeLatest) {
      runGh(['release', 'edit', params.tag, '--latest'])
    }
    return
  }

  runGh([
    'release',
    'create',
    params.tag,
    ...assets,
    '--target',
    params.targetSha,
    '--title',
    `ParkKing data ${params.releaseId}`,
    '--notes-file',
    params.readinessMarkdownPath ?? DEFAULT_READINESS_MD,
    params.makeLatest ? '--latest' : '--latest=false',
  ])
}

export const buildReleaseDataUrls = (params: {
  repository: string
  tag: string
  releaseId: string
}) => {
  const baseUrl = `https://github.com/${params.repository}/releases/download/${params.tag}`
  return {
    packageUrl: `${baseUrl}/park-king-data_${params.releaseId}.zip`,
    manifestUrl: `${baseUrl}/release_manifest_${params.releaseId}.json`,
  }
}

export const buildReleaseAssetSmokeHeaders = (params: {
  downloadToken?: string | null
  downloadAuthHeader?: string | null
}) => {
  const headers: Record<string, string> = {
    'user-agent': 'ParkKing release asset smoke',
  }
  if (params.downloadAuthHeader) {
    headers.authorization = params.downloadAuthHeader
  } else if (params.downloadToken) {
    headers.authorization = `Bearer ${params.downloadToken}`
  }
  return headers
}

const fetchReleaseAsset = async (params: {
  label: string
  url: string
  method: string
  headers: Record<string, string>
  timeoutMs: number
}) => {
  const response = await fetch(params.url, {
    method: params.method,
    headers: params.headers,
    signal: AbortSignal.timeout(params.timeoutMs),
  })
  return {
    label: params.label,
    url: params.url,
    method: params.method,
    ok: response.ok,
    status: response.status,
    contentLength: response.headers.get('content-length'),
    contentType: response.headers.get('content-type'),
    error: response.ok ? null : `HTTP ${response.status}`,
    response,
  }
}

const toSmokeCheck = (
  check: Omit<ReleaseDataAssetUrlSmokeCheck, 'error'> & {
    error?: string | null
  },
): ReleaseDataAssetUrlSmokeCheck => ({
  ...check,
  error: check.error ?? null,
})

const fetchSmokeCheck = async (params: {
  label: string
  url: string
  method: string
  headers: Record<string, string>
  timeoutMs: number
}): Promise<{
  check: ReleaseDataAssetUrlSmokeCheck
  response: Response | null
}> => {
  try {
    const result = await fetchReleaseAsset(params)
    return {
      check: toSmokeCheck(result),
      response: result.response,
    }
  } catch (error) {
    return {
      check: {
        label: params.label,
        url: params.url,
        method: params.method,
        ok: false,
        status: null,
        contentLength: null,
        contentType: null,
        error: error instanceof Error ? error.message : String(error),
      },
      response: null,
    }
  }
}

const readManifestMetadata = async (response: Response) => {
  const parsed = (await response.json()) as {
    releaseId?: unknown
    districts?: unknown
  }
  const districts = Array.isArray(parsed.districts)
    ? parsed.districts.filter(
        (district): district is { districtId: string; datasetHash: string } => {
          const record =
            district !== null &&
            typeof district === 'object' &&
            !Array.isArray(district)
              ? (district as Record<string, unknown>)
              : null
          return (
            typeof record?.districtId === 'string' &&
            typeof record.datasetHash === 'string'
          )
        },
      )
    : []
  return {
    releaseId: typeof parsed.releaseId === 'string' ? parsed.releaseId : null,
    districts,
  }
}

export const smokeReleaseDataAssetUrls = async (
  options: ReleaseDataAssetUrlSmokeOptions,
): Promise<ReleaseDataAssetUrlSmokeResult> => {
  const timeoutMs = options.timeoutMs ?? 30000
  const headers = buildReleaseAssetSmokeHeaders(options)
  const errors: string[] = []
  const checks: ReleaseDataAssetUrlSmokeCheck[] = []

  const packageCheck = await fetchSmokeCheck({
    label: 'package',
    url: options.packageUrl,
    method: 'HEAD',
    headers,
    timeoutMs,
  })
  checks.push(packageCheck.check)
  if (!packageCheck.check.ok) {
    errors.push(
      `Package URL is not reachable: ${packageCheck.check.error ?? 'unknown error'}`,
    )
  }

  const manifestCheck = await fetchSmokeCheck({
    label: 'manifest',
    url: options.manifestUrl,
    method: 'GET',
    headers,
    timeoutMs,
  })
  checks.push(manifestCheck.check)
  if (!manifestCheck.check.ok || !manifestCheck.response) {
    errors.push(
      `Manifest URL is not reachable: ${manifestCheck.check.error ?? 'unknown error'}`,
    )
  } else {
    try {
      const manifestMetadata = await readManifestMetadata(manifestCheck.response)
      const manifestReleaseId = manifestMetadata.releaseId
      if (manifestReleaseId !== options.releaseId) {
        errors.push(
          `Manifest releaseId ${manifestReleaseId ?? 'missing'} does not match ${options.releaseId}`,
        )
      }
      if (manifestMetadata.districts.length === 0) {
        errors.push('Manifest does not include district dataset hashes')
      }
    } catch (error) {
      errors.push(
        `Manifest URL did not return valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  return {
    pass: errors.length === 0,
    releaseId: options.releaseId,
    packageUrl: options.packageUrl,
    manifestUrl: options.manifestUrl,
    checks,
    errors,
  }
}

export const renderReleaseDataAssetUrlSmokeResult = (
  result: ReleaseDataAssetUrlSmokeResult,
) => {
  const lines = [
    `# Release Data Asset URL Smoke: ${result.pass ? 'PASS' : 'FAIL'}`,
    '',
    `- Release ID: ${result.releaseId}`,
    `- Package URL: ${result.packageUrl}`,
    `- Manifest URL: ${result.manifestUrl}`,
    '',
    '## Checks',
    '',
    ...result.checks.map(
      (check) =>
        `- ${check.label}: ${check.method} ${check.status ?? 'no-status'} ${
          check.ok ? 'ok' : `failed (${check.error ?? 'unknown error'})`
        }`,
    ),
    '',
    '## Errors',
    '',
    ...(result.errors.length > 0
      ? result.errors.map((error) => `- ${error}`)
      : ['- none']),
  ]
  return `${lines.join('\n')}\n`
}

const runResolveMetadata = async () => {
  const metadata = await resolveReleaseDataMetadata({
    tagInput: process.env.PARKKING_RELEASE_TAG_INPUT,
  })
  await writeGitHubFileCommand(process.env.GITHUB_OUTPUT, [
    `release_id=${metadata.releaseId}`,
    `tag=${metadata.tag}`,
  ])
  console.log(`Release ID: ${metadata.releaseId}`)
  console.log(`Release tag: ${metadata.tag}`)
}

const runPublish = async () => {
  const releaseId = process.env.PARKKING_RELEASE_ID
  const tag = process.env.PARKKING_RELEASE_TAG
  const targetSha = process.env.GITHUB_SHA
  if (!releaseId || !tag || !targetSha) {
    throw new Error('PARKKING_RELEASE_ID, PARKKING_RELEASE_TAG, and GITHUB_SHA are required')
  }
  await publishReleaseDataAssets({
    releaseId,
    tag,
    targetSha,
    makeLatest: process.env.PARKKING_RELEASE_LATEST === 'true',
  })
}

const runSummarize = async () => {
  const releaseId = process.env.PARKKING_RELEASE_ID
  const tag = process.env.PARKKING_RELEASE_TAG
  const repository = process.env.GITHUB_REPOSITORY
  if (!releaseId || !tag || !repository) {
    throw new Error('PARKKING_RELEASE_ID, PARKKING_RELEASE_TAG, and GITHUB_REPOSITORY are required')
  }
  const urls = buildReleaseDataUrls({ repository, tag, releaseId })
  await writeGitHubFileCommand(process.env.GITHUB_STEP_SUMMARY, [
    '## Render release data URLs',
    '',
    `- PARKKING_RELEASE_PACKAGE_URL=${urls.packageUrl}`,
    `- PARKKING_RELEASE_MANIFEST_URL=${urls.manifestUrl}`,
    '',
    '## Live deploy verification',
    '',
    `Run: \`npm run ops:render-deployment-verify -- --app-url <Render service URL> --manifest-url ${urls.manifestUrl}\``,
  ])
  console.log(`PARKKING_RELEASE_PACKAGE_URL=${urls.packageUrl}`)
  console.log(`PARKKING_RELEASE_MANIFEST_URL=${urls.manifestUrl}`)
  console.log(
    `VERIFY_RENDER_DEPLOY=npm run ops:render-deployment-verify -- --app-url <Render service URL> --manifest-url ${urls.manifestUrl}`,
  )
}

const runSmokeUrls = async () => {
  const releaseId = process.env.PARKKING_RELEASE_ID
  const tag = process.env.PARKKING_RELEASE_TAG
  const repository = process.env.GITHUB_REPOSITORY
  if (!releaseId || !tag || !repository) {
    throw new Error('PARKKING_RELEASE_ID, PARKKING_RELEASE_TAG, and GITHUB_REPOSITORY are required')
  }
  const urls = buildReleaseDataUrls({ repository, tag, releaseId })
  const result = await smokeReleaseDataAssetUrls({
    releaseId,
    packageUrl: urls.packageUrl,
    manifestUrl: urls.manifestUrl,
    downloadToken: process.env.PARKKING_RELEASE_DOWNLOAD_TOKEN,
    downloadAuthHeader: process.env.PARKKING_RELEASE_DOWNLOAD_AUTH_HEADER,
  })
  console.log(renderReleaseDataAssetUrlSmokeResult(result))
  if (!result.pass) {
    process.exit(1)
  }
}

const run = async () => {
  const mode = getMode(process.argv.slice(2))
  if (mode === 'resolve-meta') {
    await runResolveMetadata()
    return
  }
  if (mode === 'publish') {
    await runPublish()
    return
  }
  if (mode === 'summarize') {
    await runSummarize()
    return
  }
  if (mode === 'smoke-urls') {
    await runSmokeUrls()
    return
  }
  throw new Error('Usage: tsx releaseDataWorkflow.ts --mode <resolve-meta|publish|summarize|smoke-urls>')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
