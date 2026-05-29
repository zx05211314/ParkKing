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
  ])
  console.log(`PARKKING_RELEASE_PACKAGE_URL=${urls.packageUrl}`)
  console.log(`PARKKING_RELEASE_MANIFEST_URL=${urls.manifestUrl}`)
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
  throw new Error('Usage: tsx releaseDataWorkflow.ts --mode <resolve-meta|publish|summarize>')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
