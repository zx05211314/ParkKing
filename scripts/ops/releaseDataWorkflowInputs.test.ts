import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  resolveReleaseDataWorkflowInputs,
  writeReleaseDataWorkflowEnv,
} from './releaseDataWorkflowInputs'

describe('releaseDataWorkflowInputs', () => {
  it('derives release id from data tag push events', () => {
    expect(
      resolveReleaseDataWorkflowInputs({
        PARKKING_WORKFLOW_EVENT_NAME: 'push',
        PARKKING_WORKFLOW_REF_NAME: 'data-20260605140713_21e282f',
      }),
    ).toMatchObject({
      releaseConfigsGlob: 'configs/prod/*.json',
      releaseAllowWarn: 'true',
      releaseAllowBaselineAdopt: 'true',
      releaseAllowReviewedCaseHashMismatch: 'false',
      releaseAllowAnswerCaseReviewFallback: 'true',
      releaseOverrideReason:
        'Tag-triggered release uses reviewed UI, P3, deploy, and URL-smoke gates after production ingest.',
      releaseTagInput: 'data-20260605140713_21e282f',
      releaseIdInput: '20260605140713_21e282f',
      releaseLatest: 'false',
    })
  })

  it('keeps dispatch inputs when not triggered by tag push', () => {
    expect(
      resolveReleaseDataWorkflowInputs({
        PARKKING_WORKFLOW_EVENT_NAME: 'workflow_dispatch',
        PARKKING_INPUT_CONFIGS_GLOB: 'configs/dev/*.json',
        PARKKING_INPUT_TAG: 'data-manual',
        PARKKING_INPUT_ALLOW_WARN: 'false',
        PARKKING_INPUT_OVERRIDE_REASON: 'manual override',
        PARKKING_INPUT_LATEST: 'true',
      }),
    ).toMatchObject({
      releaseConfigsGlob: 'configs/dev/*.json',
      releaseAllowWarn: 'false',
      releaseAllowBaselineAdopt: 'false',
      releaseAllowReviewedCaseHashMismatch: 'false',
      releaseAllowAnswerCaseReviewFallback: 'false',
      releaseOverrideReason: 'manual override',
      releaseTagInput: 'data-manual',
      releaseIdInput: 'manual',
      releaseLatest: 'true',
    })
  })

  it('exports baseline adopt env for tag-triggered releases', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'release-inputs-'))
    const envPath = path.join(base, 'github-env')

    await writeReleaseDataWorkflowEnv(
      resolveReleaseDataWorkflowInputs({
        PARKKING_WORKFLOW_EVENT_NAME: 'push',
        PARKKING_WORKFLOW_REF_NAME: 'data-20260605140713_21e282f',
      }),
      envPath,
    )

    await expect(fs.readFile(envPath, 'utf-8')).resolves.toContain(
      'PARKKING_ALLOW_BASELINE_ADOPT=true',
    )
    await expect(fs.readFile(envPath, 'utf-8')).resolves.toContain(
      'PARKKING_ALLOW_REVIEWED_CASE_HASH_MISMATCH=false',
    )
    await expect(fs.readFile(envPath, 'utf-8')).resolves.toContain(
      'PARKKING_ALLOW_ANSWER_CASE_REVIEW_FALLBACK=true',
    )
  })
})
