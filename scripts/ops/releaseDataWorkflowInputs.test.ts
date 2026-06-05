import { describe, expect, it } from 'vitest'
import { resolveReleaseDataWorkflowInputs } from './releaseDataWorkflowInputs'

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
      releaseOverrideReason: 'manual override',
      releaseTagInput: 'data-manual',
      releaseIdInput: 'manual',
      releaseLatest: 'true',
    })
  })
})
