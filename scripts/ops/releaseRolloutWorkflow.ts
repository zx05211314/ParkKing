import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  getArgValue,
  normalizeGithubRepository,
} from './githubWorkflowDispatch'

const DEFAULT_ARTIFACT_NAME = 'release-data-package'
const DEFAULT_DOWNLOAD_ROOT = '.tmp/release-data-upstream'
const HANDOFF_RELATIVE_PATH = path.join(
  '.tmp',
  'render-deployment-handoff.json',
)

export type ReleaseRolloutWorkflowMode = 'download-handoff' | 'mark-latest'

export interface ReleaseRolloutWorkflowOptions {
  mode: ReleaseRolloutWorkflowMode
  repository: string
  upstreamRunId: string
  artifactName: string
  downloadRoot: string
  handoffJsonPath: string
}

export interface ReleaseRolloutHandoff {
  ready: boolean
  releaseId: string
  releaseTag: string
  packageUrl: string
  manifestUrl: string
  districtCount: number
}

export interface ReleaseRolloutWorkflowResult {
  mode: ReleaseRolloutWorkflowMode
  repository: string
  handoffJsonPath: string
  handoff: ReleaseRolloutHandoff
  command: string[]
}

export type ReleaseRolloutCommandRunner = (
  command: string,
  args: string[],
) => { status: number | null; error?: Error }

const defaultCommandRunner: ReleaseRolloutCommandRunner = (command, args) => {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'inherit',
  })
  return {
    status: result.status,
    error: result.error,
  }
}

const parseMode = (value: string | null): ReleaseRolloutWorkflowMode => {
  if (value === 'download-handoff' || value === 'mark-latest') {
    return value
  }
  throw new Error('--mode must be download-handoff or mark-latest')
}

const requireRepository = (value: string | null | undefined) => {
  const normalized = normalizeGithubRepository(value)
  if (!normalized) {
    throw new Error('Missing or invalid --repo owner/name or GITHUB_REPOSITORY')
  }
  return normalized
}

const validateRunId = (value: string) => {
  if (!/^\d+$/u.test(value)) {
    throw new Error('upstream run id must contain only digits')
  }
  return value
}

export const parseReleaseRolloutWorkflowArgs = (
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): ReleaseRolloutWorkflowOptions => {
  const mode = parseMode(getArgValue(argv, '--mode'))
  const downloadRoot =
    getArgValue(argv, '--download-root', '--downloadRoot') ??
    DEFAULT_DOWNLOAD_ROOT
  return {
    mode,
    repository: requireRepository(
      getArgValue(argv, '--repo', '--repository') ?? env.GITHUB_REPOSITORY,
    ),
    upstreamRunId:
      getArgValue(argv, '--upstream-run-id', '--upstreamRunId') ??
      env.PARKKING_UPSTREAM_RUN_ID?.trim() ??
      '',
    artifactName:
      getArgValue(argv, '--artifact-name', '--artifactName') ??
      DEFAULT_ARTIFACT_NAME,
    downloadRoot,
    handoffJsonPath:
      getArgValue(argv, '--handoff-json', '--handoffJson') ??
      path.join(downloadRoot, HANDOFF_RELATIVE_PATH),
  }
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const getString = (record: Record<string, unknown> | null, key: string) =>
  typeof record?.[key] === 'string' ? record[key] : ''

export const readReleaseRolloutHandoff = async (
  handoffJsonPath: string,
): Promise<ReleaseRolloutHandoff> => {
  const parsed = toRecord(
    JSON.parse(await fs.readFile(handoffJsonPath, 'utf-8')) as unknown,
  )
  const release = toRecord(parsed?.release)
  const expectedDatasets = Array.isArray(parsed?.expectedDatasets)
    ? parsed.expectedDatasets
    : []
  const incompleteDatasetIdentities = expectedDatasets.flatMap(
    (entry, index) => {
      const record = toRecord(entry)
      const districtId = getString(record, 'districtId')
      return districtId &&
        getString(record, 'datasetHash') &&
        getString(record, 'publishedAt')
        ? []
        : [districtId || `entry ${index + 1}`]
    },
  )
  const datasetDistrictIds = expectedDatasets.flatMap((entry) => {
    const districtId = getString(toRecord(entry), 'districtId')
    return districtId ? [districtId] : []
  })
  const duplicateDatasetIdentities = [
    ...new Set(
      datasetDistrictIds.filter(
        (districtId, index) =>
          datasetDistrictIds.indexOf(districtId) !== index,
      ),
    ),
  ]
  const handoff = {
    ready: parsed?.ready === true,
    releaseId: getString(release, 'releaseId'),
    releaseTag: getString(release, 'tag'),
    packageUrl: getString(parsed, 'packageUrl'),
    manifestUrl: getString(parsed, 'manifestUrl'),
    districtCount: expectedDatasets.length,
  }
  const errors = [
    ...(handoff.ready ? [] : ['handoff is not marked ready']),
    ...(handoff.releaseId ? [] : ['release.releaseId is missing']),
    ...(handoff.releaseTag.startsWith('data-')
      ? []
      : ['release.tag must start with data-']),
    ...(handoff.packageUrl ? [] : ['packageUrl is missing']),
    ...(handoff.manifestUrl ? [] : ['manifestUrl is missing']),
    ...(handoff.districtCount > 0 ? [] : ['expectedDatasets is empty']),
    ...(incompleteDatasetIdentities.length > 0
      ? [
          `expectedDatasets has incomplete district identities: ${incompleteDatasetIdentities.join(', ')}`,
        ]
      : []),
    ...(duplicateDatasetIdentities.length > 0
      ? [
          `expectedDatasets has duplicate district identities: ${duplicateDatasetIdentities.join(', ')}`,
        ]
      : []),
  ]
  if (errors.length > 0) {
    throw new Error(
      `Invalid release rollout handoff ${handoffJsonPath}: ${errors.join('; ')}`,
    )
  }
  return handoff
}

const runCommand = (
  command: string,
  args: string[],
  runner: ReleaseRolloutCommandRunner,
) => {
  const result = runner(command, args)
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit ${String(result.status)}`,
    )
  }
}

export const runReleaseRolloutWorkflow = async (
  options: ReleaseRolloutWorkflowOptions,
  runner: ReleaseRolloutCommandRunner = defaultCommandRunner,
): Promise<ReleaseRolloutWorkflowResult> => {
  if (options.mode === 'download-handoff') {
    const upstreamRunId = validateRunId(options.upstreamRunId)
    const command = [
      'run',
      'download',
      upstreamRunId,
      '--repo',
      options.repository,
      '--name',
      options.artifactName,
      '--dir',
      options.downloadRoot,
    ]
    runCommand('gh', command, runner)
    return {
      mode: options.mode,
      repository: options.repository,
      handoffJsonPath: options.handoffJsonPath,
      handoff: await readReleaseRolloutHandoff(options.handoffJsonPath),
      command: ['gh', ...command],
    }
  }

  const handoff = await readReleaseRolloutHandoff(options.handoffJsonPath)
  const command = [
    'release',
    'edit',
    handoff.releaseTag,
    '--repo',
    options.repository,
    '--latest',
  ]
  runCommand('gh', command, runner)
  return {
    mode: options.mode,
    repository: options.repository,
    handoffJsonPath: options.handoffJsonPath,
    handoff,
    command: ['gh', ...command],
  }
}

export const renderReleaseRolloutWorkflowResult = (
  result: ReleaseRolloutWorkflowResult,
) => [
  `# Release Rollout Workflow: ${result.mode}`,
  '',
  `- Repository: ${result.repository}`,
  `- Handoff JSON: ${result.handoffJsonPath}`,
  `- Release ID: ${result.handoff.releaseId}`,
  `- Release tag: ${result.handoff.releaseTag}`,
  `- Districts: ${result.handoff.districtCount}`,
  `- Command: ${result.command.join(' ')}`,
  '',
].join('\n')

const run = async () => {
  const argv = process.argv.slice(2)
  if (argv.includes('--help')) {
    console.log(
      [
        'Usage: tsx scripts/ops/releaseRolloutWorkflow.ts --mode <mode> [options]',
        '',
        'Modes:',
        '  download-handoff   Download and validate the upstream release artifact',
        '  mark-latest        Mark the validated handoff release as GitHub Latest',
        '',
        'Options:',
        '  --repo <owner/name>       Defaults to GITHUB_REPOSITORY',
        '  --upstream-run-id <id>    Defaults to PARKKING_UPSTREAM_RUN_ID',
        '  --artifact-name <name>    Defaults to release-data-package',
        '  --download-root <path>    Defaults to .tmp/release-data-upstream',
        '  --handoff-json <path>     Defaults below the download root',
      ].join('\n'),
    )
    return
  }

  const result = await runReleaseRolloutWorkflow(
    parseReleaseRolloutWorkflowArgs(argv),
  )
  console.log(renderReleaseRolloutWorkflowResult(result))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
