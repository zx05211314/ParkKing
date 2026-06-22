import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  buildRenderDeploymentEnv,
  renderEnvAssignments,
} from './renderDeploymentEnv'

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

type FetchImpl = typeof fetch

interface GitHubRelease {
  id: number
}

interface GitHubReleaseAsset {
  id: number
  name: string
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

const listReleaseAssetPaths = async (
  releaseDir = DEFAULT_RELEASE_DIR,
  explicitAssetPaths?: string[] | null,
) => {
  if (explicitAssetPaths) {
    const sortedAssetPaths = [...explicitAssetPaths].sort()
    if (sortedAssetPaths.length === 0) {
      throw new Error('No release assets were provided')
    }
    return sortedAssetPaths
  }

  const entries = await fs.readdir(releaseDir, { withFileTypes: true })
  const discoveredAssetPaths = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        (/^park-king-data_.+\.zip$/.test(entry.name) ||
          /^release_manifest_.+\.json$/.test(entry.name)),
    )
    .map((entry) => path.join(releaseDir, entry.name))
    .sort()

  if (discoveredAssetPaths.length === 0) {
    throw new Error(`No release assets found in ${releaseDir}`)
  }
  return discoveredAssetPaths
}

const buildGitHubApiHeaders = (
  token: string,
  extraHeaders?: Record<string, string>,
) => ({
  accept: 'application/vnd.github+json',
  authorization: `Bearer ${token}`,
  'user-agent': 'ParkKing release publisher',
  'x-github-api-version': '2022-11-28',
  ...extraHeaders,
})

const readGitHubErrorBody = async (response: Response) => {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

const assertGitHubResponse = async (response: Response, action: string) => {
  if (response.ok) {
    return
  }
  const body = await readGitHubErrorBody(response)
  throw new Error(
    `${action} failed with HTTP ${response.status}${body ? `: ${body}` : ''}`,
  )
}

const githubApiUrl = (repository: string, suffix: string) =>
  `https://api.github.com/repos/${repository}${suffix}`

const getGitHubReleaseByTag = async (params: {
  repository: string
  tag: string
  token: string
  fetchImpl: FetchImpl
}) => {
  const response = await params.fetchImpl(
    githubApiUrl(
      params.repository,
      `/releases/tags/${encodeURIComponent(params.tag)}`,
    ),
    {
      headers: buildGitHubApiHeaders(params.token),
    },
  )
  if (response.status === 404) {
    return null
  }
  await assertGitHubResponse(response, `GitHub release lookup ${params.tag}`)
  return (await response.json()) as GitHubRelease
}

const createGitHubRelease = async (params: {
  repository: string
  releaseId: string
  tag: string
  targetSha: string
  makeLatest: boolean
  notesPath: string
  token: string
  fetchImpl: FetchImpl
}) => {
  const notes = await fs.readFile(params.notesPath, 'utf-8')
  const response = await params.fetchImpl(
    githubApiUrl(params.repository, '/releases'),
    {
      method: 'POST',
      headers: buildGitHubApiHeaders(params.token, {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        tag_name: params.tag,
        target_commitish: params.targetSha,
        name: `ParkKing data ${params.releaseId}`,
        body: notes,
        draft: false,
        prerelease: false,
        make_latest: params.makeLatest ? 'true' : 'false',
      }),
    },
  )
  await assertGitHubResponse(response, `GitHub release create ${params.tag}`)
  return (await response.json()) as GitHubRelease
}

const updateGitHubReleaseLatest = async (params: {
  repository: string
  releaseId: number
  token: string
  fetchImpl: FetchImpl
}) => {
  const response = await params.fetchImpl(
    githubApiUrl(params.repository, `/releases/${params.releaseId}`),
    {
      method: 'PATCH',
      headers: buildGitHubApiHeaders(params.token, {
        'content-type': 'application/json',
      }),
      body: JSON.stringify({
        make_latest: 'true',
      }),
    },
  )
  await assertGitHubResponse(
    response,
    `GitHub release mark latest ${params.releaseId}`,
  )
}

const listGitHubReleaseAssets = async (params: {
  repository: string
  releaseId: number
  token: string
  fetchImpl: FetchImpl
}) => {
  const response = await params.fetchImpl(
    githubApiUrl(params.repository, `/releases/${params.releaseId}/assets?per_page=100`),
    {
      headers: buildGitHubApiHeaders(params.token),
    },
  )
  await assertGitHubResponse(
    response,
    `GitHub release asset list ${params.releaseId}`,
  )
  return (await response.json()) as GitHubReleaseAsset[]
}

const deleteGitHubReleaseAsset = async (params: {
  repository: string
  assetId: number
  token: string
  fetchImpl: FetchImpl
}) => {
  const response = await params.fetchImpl(
    githubApiUrl(params.repository, `/releases/assets/${params.assetId}`),
    {
      method: 'DELETE',
      headers: buildGitHubApiHeaders(params.token),
    },
  )
  await assertGitHubResponse(
    response,
    `GitHub release asset delete ${params.assetId}`,
  )
}

const getReleaseAssetContentType = (assetPath: string) =>
  assetPath.endsWith('.json') ? 'application/json' : 'application/zip'

const uploadGitHubReleaseAsset = async (params: {
  repository: string
  releaseId: number
  assetPath: string
  token: string
  fetchImpl: FetchImpl
}) => {
  const assetName = path.basename(params.assetPath)
  const content = await fs.readFile(params.assetPath)
  const response = await params.fetchImpl(
    `https://uploads.github.com/repos/${params.repository}/releases/${
      params.releaseId
    }/assets?name=${encodeURIComponent(assetName)}`,
    {
      method: 'POST',
      headers: buildGitHubApiHeaders(params.token, {
        'content-type': getReleaseAssetContentType(params.assetPath),
      }),
      body: content as unknown as BodyInit,
    },
  )
  await assertGitHubResponse(response, `GitHub release asset upload ${assetName}`)
}

const publishReleaseDataAssetsWithApi = async (params: {
  releaseId: string
  tag: string
  targetSha: string
  makeLatest: boolean
  repository: string
  token: string
  releaseDir?: string
  assetPaths?: string[] | null
  readinessMarkdownPath?: string
  fetchImpl?: FetchImpl
}) => {
  const fetchImpl = params.fetchImpl ?? fetch
  const assets = await listReleaseAssetPaths(params.releaseDir, params.assetPaths)
  let release = await getGitHubReleaseByTag({
    repository: params.repository,
    tag: params.tag,
    token: params.token,
    fetchImpl,
  })
  const releaseAlreadyExisted = Boolean(release)
  if (!release) {
    release = await createGitHubRelease({
      repository: params.repository,
      releaseId: params.releaseId,
      tag: params.tag,
      targetSha: params.targetSha,
      makeLatest: params.makeLatest,
      notesPath: params.readinessMarkdownPath ?? DEFAULT_READINESS_MD,
      token: params.token,
      fetchImpl,
    })
  }

  const existingAssets = releaseAlreadyExisted
    ? await listGitHubReleaseAssets({
        repository: params.repository,
        releaseId: release.id,
        token: params.token,
        fetchImpl,
      })
    : []
  for (const assetPath of assets) {
    const assetName = path.basename(assetPath)
    const existingAsset = existingAssets.find((asset) => asset.name === assetName)
    if (existingAsset) {
      await deleteGitHubReleaseAsset({
        repository: params.repository,
        assetId: existingAsset.id,
        token: params.token,
        fetchImpl,
      })
    }
    await uploadGitHubReleaseAsset({
      repository: params.repository,
      releaseId: release.id,
      assetPath,
      token: params.token,
      fetchImpl,
    })
  }

  if (releaseAlreadyExisted && params.makeLatest) {
    await updateGitHubReleaseLatest({
      repository: params.repository,
      releaseId: release.id,
      token: params.token,
      fetchImpl,
    })
  }
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
  repository?: string | null
  token?: string | null
  releaseDir?: string
  assetPaths?: string[] | null
  readinessMarkdownPath?: string
  fetchImpl?: FetchImpl
}) => {
  const token = params.token?.trim()
  const repository = params.repository?.trim()
  if (token && repository) {
    await publishReleaseDataAssetsWithApi({
      releaseId: params.releaseId,
      tag: params.tag,
      targetSha: params.targetSha,
      makeLatest: params.makeLatest,
      repository,
      token,
      releaseDir: params.releaseDir,
      assetPaths: params.assetPaths,
      readinessMarkdownPath: params.readinessMarkdownPath,
      fetchImpl: params.fetchImpl,
    })
    return
  }

  const assets = await listReleaseAssetPaths(params.releaseDir, params.assetPaths)
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

const cancelResponseBody = async (response: Response | null) => {
  if (!response?.body) {
    return
  }
  try {
    await response.body.cancel()
  } catch {
    // The URL smoke only needs headers/status. Ignore cancellation races.
  }
}

const fetchPackageSmokeChecks = async (params: {
  url: string
  headers: Record<string, string>
  timeoutMs: number
}) => {
  const checks: ReleaseDataAssetUrlSmokeCheck[] = []
  const headCheck = await fetchSmokeCheck({
    label: 'package',
    url: params.url,
    method: 'HEAD',
    headers: params.headers,
    timeoutMs: params.timeoutMs,
  })
  checks.push(headCheck.check)
  if (headCheck.check.ok) {
    return { checks, ok: true, error: null }
  }

  const rangeGetCheck = await fetchSmokeCheck({
    label: 'package-range',
    url: params.url,
    method: 'GET',
    headers: {
      ...params.headers,
      range: 'bytes=0-0',
    },
    timeoutMs: params.timeoutMs,
  })
  await cancelResponseBody(rangeGetCheck.response)
  checks.push(rangeGetCheck.check)
  if (rangeGetCheck.check.ok) {
    return { checks, ok: true, error: null }
  }

  return {
    checks,
    ok: false,
    error: `HEAD ${headCheck.check.error ?? 'unknown error'}; range GET ${
      rangeGetCheck.check.error ?? 'unknown error'
    }`,
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

  const packageCheck = await fetchPackageSmokeChecks({
    url: options.packageUrl,
    headers,
    timeoutMs,
  })
  checks.push(...packageCheck.checks)
  if (!packageCheck.ok) {
    errors.push(
      `Package URL is not reachable: ${packageCheck.error ?? 'unknown error'}`,
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

export const buildReleaseDataSummaryLines = (urls: {
  packageUrl: string
  manifestUrl: string
}) => {
  const renderEnv = renderEnvAssignments(buildRenderDeploymentEnv(urls))
  return [
    '## Render environment',
    '',
    ...renderEnv.map((line) => `- ${line}`),
    '',
    '## Live deploy verification',
    '',
    `GitHub Actions: Render Live Verify with appUrl=<Render service URL>, manifestUrl=${urls.manifestUrl}, useGithubToken=true only for private GitHub Release assets, skipSyncIssueRoundtrip=false unless the live environment intentionally rejects sync smoke writes.`,
    `Local: \`npm run ops:render-deployment-verify -- --app-url <Render service URL> --manifest-url ${urls.manifestUrl}\``,
  ]
}

export const buildReleaseDataConsoleLines = (urls: {
  packageUrl: string
  manifestUrl: string
}) => [
  ...renderEnvAssignments(buildRenderDeploymentEnv(urls)),
  `VERIFY_RENDER_DEPLOY_WORKFLOW_INPUTS=appUrl=<Render service URL> manifestUrl=${urls.manifestUrl} useGithubToken=<true for private release assets, false for public assets> skipSyncIssueRoundtrip=false`,
  `VERIFY_RENDER_DEPLOY_LOCAL=npm run ops:render-deployment-verify -- --app-url <Render service URL> --manifest-url ${urls.manifestUrl}`,
]

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
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
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
  await writeGitHubFileCommand(
    process.env.GITHUB_STEP_SUMMARY,
    buildReleaseDataSummaryLines(urls),
  )
  buildReleaseDataConsoleLines(urls).forEach((line) => console.log(line))
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
