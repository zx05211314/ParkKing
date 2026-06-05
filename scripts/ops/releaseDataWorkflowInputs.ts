import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validateReleaseId } from './packageReleaseUtils'

type Env = NodeJS.ProcessEnv

const DEFAULT_CONFIGS_GLOB = 'configs/prod/*.json'
const TAG_TRIGGER_ALLOW_WARN_OVERRIDE_REASON =
  'Tag-triggered release uses reviewed UI, P3, deploy, and URL-smoke gates after production ingest.'

export interface ReleaseDataWorkflowInputs {
  releaseConfigsGlob: string
  releaseAllowWarn: string
  releaseAllowBaselineAdopt: string
  releaseAllowReviewedCaseHashMismatch: string
  releaseOverrideReason: string
  releaseTagInput: string
  releaseIdInput: string
  releaseLatest: string
}

const normalizeText = (value: string | null | undefined) => value?.trim() ?? ''

const normalizeBooleanText = (value: string | null | undefined) =>
  normalizeText(value).toLowerCase() === 'true' ? 'true' : 'false'

export const resolveReleaseDataWorkflowInputs = (
  env: Env = process.env,
): ReleaseDataWorkflowInputs => {
  const eventName =
    normalizeText(env.PARKKING_WORKFLOW_EVENT_NAME) ||
    normalizeText(env.GITHUB_EVENT_NAME)
  const refName =
    normalizeText(env.PARKKING_WORKFLOW_REF_NAME) ||
    normalizeText(env.GITHUB_REF_NAME)
  const tagInput =
    eventName === 'push'
      ? refName
      : normalizeText(env.PARKKING_INPUT_TAG) ||
        normalizeText(env.PARKKING_RELEASE_TAG_INPUT)
  const releaseIdInput = tagInput.startsWith('data-')
    ? validateReleaseId(tagInput.slice('data-'.length))
    : ''
  const isDataTagPush = eventName === 'push' && tagInput.startsWith('data-')

  return {
    releaseConfigsGlob:
      normalizeText(env.PARKKING_INPUT_CONFIGS_GLOB) || DEFAULT_CONFIGS_GLOB,
    releaseAllowWarn: isDataTagPush
      ? 'true'
      : normalizeBooleanText(env.PARKKING_INPUT_ALLOW_WARN),
    releaseAllowBaselineAdopt: isDataTagPush ? 'true' : 'false',
    releaseAllowReviewedCaseHashMismatch: isDataTagPush ? 'true' : 'false',
    releaseOverrideReason: isDataTagPush
      ? TAG_TRIGGER_ALLOW_WARN_OVERRIDE_REASON
      : normalizeText(env.PARKKING_INPUT_OVERRIDE_REASON),
    releaseTagInput: tagInput,
    releaseIdInput,
    releaseLatest: normalizeBooleanText(env.PARKKING_INPUT_LATEST),
  }
}

const githubEnvLines = (inputs: ReleaseDataWorkflowInputs) => [
  `RELEASE_CONFIGS_GLOB=${inputs.releaseConfigsGlob}`,
  `RELEASE_ALLOW_WARN=${inputs.releaseAllowWarn}`,
  `PARKKING_ALLOW_BASELINE_ADOPT=${inputs.releaseAllowBaselineAdopt}`,
  `PARKKING_ALLOW_REVIEWED_CASE_HASH_MISMATCH=${inputs.releaseAllowReviewedCaseHashMismatch}`,
  `RELEASE_OVERRIDE_REASON=${inputs.releaseOverrideReason}`,
  `PARKKING_RELEASE_TAG_INPUT=${inputs.releaseTagInput}`,
  `PARKKING_RELEASE_ID_INPUT=${inputs.releaseIdInput}`,
  `PARKKING_RELEASE_LATEST=${inputs.releaseLatest}`,
]

export const writeReleaseDataWorkflowEnv = async (
  inputs: ReleaseDataWorkflowInputs,
  envPath: string | null | undefined = process.env.GITHUB_ENV,
) => {
  if (!envPath) {
    return false
  }
  await fs.appendFile(envPath, `${githubEnvLines(inputs).join('\n')}\n`, 'utf-8')
  return true
}

const run = async () => {
  const inputs = resolveReleaseDataWorkflowInputs()
  const wroteEnv = await writeReleaseDataWorkflowEnv(inputs)
  console.log(
    `Release workflow inputs resolved: configs=${inputs.releaseConfigsGlob}, tag=${
      inputs.releaseTagInput || '-'
    }, releaseId=${inputs.releaseIdInput || '-'}, latest=${inputs.releaseLatest}`,
  )
  if (!wroteEnv) {
    console.log('GITHUB_ENV is not set; resolved inputs were not exported.')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
