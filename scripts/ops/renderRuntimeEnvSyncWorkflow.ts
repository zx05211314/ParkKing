import { fileURLToPath } from 'node:url'
import { validateReleaseId } from './packageReleaseUtils'
import {
  parseRenderRuntimeEnvSyncArgs,
  renderRenderRuntimeEnvSyncResult,
  syncRenderRuntimeEnv,
  writeRenderRuntimeEnvSyncOutputs,
  type RenderRuntimeEnvSyncOptions,
} from './syncRenderRuntimeEnv'

const DEFAULT_SERVICE_NAME = 'parkking'
const DEFAULT_OUT_PATH = '.tmp/render-runtime-env-sync.md'
const DEFAULT_JSON_OUT_PATH = '.tmp/render-runtime-env-sync.json'

type Env = NodeJS.ProcessEnv

const normalizeText = (value: string | null | undefined) => value?.trim() ?? ''

const isTruthy = (value: string | null | undefined) => {
  const normalized = normalizeText(value).toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const appendArg = (argv: string[], flag: string, value: string) => {
  if (value) {
    argv.push(flag, value)
  }
}

const releaseAssetUrls = (repository: string, releaseTag: string) => {
  const releaseId = validateReleaseId(releaseTag.slice('data-'.length))
  const baseUrl = `https://github.com/${repository}/releases/download/${releaseTag}`
  return {
    packageUrl: `${baseUrl}/park-king-data_${releaseId}.zip`,
    manifestUrl: `${baseUrl}/release_manifest_${releaseId}.json`,
  }
}

const buildArgs = (params: {
  serviceId: string
  serviceName: string
  handoffJsonPath: string
  packageUrl: string
  manifestUrl: string
  execute: boolean
  deploy: boolean
  deployMode: string
  outPath: string
  jsonOutPath: string
}) => {
  const argv: string[] = []
  appendArg(argv, '--service-id', params.serviceId)
  appendArg(argv, '--service-name', params.serviceName)
  appendArg(argv, '--handoff-json', params.handoffJsonPath)
  appendArg(argv, '--package-url', params.packageUrl)
  appendArg(argv, '--manifest-url', params.manifestUrl)
  if (params.execute) {
    argv.push('--execute')
  }
  if (params.deploy) {
    argv.push('--deploy')
  }
  appendArg(argv, '--deploy-mode', params.deployMode)
  appendArg(argv, '--out', params.outPath)
  appendArg(argv, '--json-out', params.jsonOutPath)
  return argv
}

export const resolveRenderRuntimeEnvSyncWorkflowOptions = (
  env: Env = process.env,
): RenderRuntimeEnvSyncOptions => {
  const eventName =
    normalizeText(env.PARKKING_WORKFLOW_EVENT_NAME) ||
    normalizeText(env.GITHUB_EVENT_NAME)
  const repository =
    normalizeText(env.PARKKING_REPOSITORY) ||
    normalizeText(env.GITHUB_REPOSITORY)
  const outPath = normalizeText(env.PARKKING_SYNC_OUT_PATH) || DEFAULT_OUT_PATH
  const jsonOutPath =
    normalizeText(env.PARKKING_SYNC_JSON_OUT_PATH) || DEFAULT_JSON_OUT_PATH

  if (eventName === 'workflow_run') {
    const handoffJsonPath = normalizeText(
      env.PARKKING_WORKFLOW_RUN_HANDOFF_JSON,
    )
    const releaseTag = normalizeText(env.PARKKING_WORKFLOW_RUN_HEAD_BRANCH)
    if (!handoffJsonPath && !releaseTag.startsWith('data-')) {
      throw new Error(`workflow_run head branch is not a data tag: ${releaseTag || '-'}`)
    }
    if (!repository) {
      throw new Error('GITHUB_REPOSITORY is required to derive release asset URLs.')
    }
    const urls = handoffJsonPath
      ? { packageUrl: '', manifestUrl: '' }
      : releaseAssetUrls(repository, releaseTag)
    return parseRenderRuntimeEnvSyncArgs(
      buildArgs({
        serviceId: '',
        serviceName: DEFAULT_SERVICE_NAME,
        handoffJsonPath,
        packageUrl: urls.packageUrl,
        manifestUrl: urls.manifestUrl,
        execute: true,
        deploy: true,
        deployMode: 'build_and_deploy',
        outPath,
        jsonOutPath,
      }),
      env,
    )
  }

  return parseRenderRuntimeEnvSyncArgs(
    buildArgs({
      serviceId: normalizeText(env.PARKKING_INPUT_SERVICE_ID),
      serviceName:
        normalizeText(env.PARKKING_INPUT_SERVICE_NAME) || DEFAULT_SERVICE_NAME,
      handoffJsonPath: '',
      packageUrl: normalizeText(env.PARKKING_INPUT_PACKAGE_URL),
      manifestUrl: normalizeText(env.PARKKING_INPUT_MANIFEST_URL),
      execute: isTruthy(env.PARKKING_INPUT_EXECUTE),
      deploy: isTruthy(env.PARKKING_INPUT_DEPLOY),
      deployMode:
        normalizeText(env.PARKKING_INPUT_DEPLOY_MODE) || 'build_and_deploy',
      outPath,
      jsonOutPath,
    }),
    env,
  )
}

const run = async () => {
  const options = resolveRenderRuntimeEnvSyncWorkflowOptions()
  const result = await syncRenderRuntimeEnv(options)
  await writeRenderRuntimeEnvSyncOutputs(result, options)
  console.log(renderRenderRuntimeEnvSyncResult(result))
  if (!result.pass) {
    process.exit(1)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
