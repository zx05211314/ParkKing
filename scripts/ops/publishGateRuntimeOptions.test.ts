import { describe, expect, it } from 'vitest'
import { resolvePublishGateRuntimeOptions } from './publishGateRuntimeOptions'

describe('publishGateRuntimeOptions', () => {
  it('resolves defaults and env-driven flags', async () => {
    await expect(
      resolvePublishGateRuntimeOptions(
        { overrideReason: 'allow baseline adopt in test' },
        {
          env: {
            PARKKING_ALLOW_BASELINE_ADOPT: 'true',
            PARKKING_GATE_STRICT: 'yes',
          },
          resolveDefaultReport: async () => 'report.json',
        },
      ),
    ).resolves.toMatchObject({
      reportPath: 'report.json',
      mode: 'strict',
      allowWarn: false,
      allowFail: false,
      allowBaselineAdopt: true,
      outputDir: 'public/data/generated',
      strictDiff: true,
    })
  })

  it('requires an override reason when override flags are enabled', async () => {
    await expect(
      resolvePublishGateRuntimeOptions(
        { allowWarn: true },
        {
          resolveDefaultReport: async () => 'report.json',
        },
      ),
    ).rejects.toThrow(/Override reason is required/)
  })
})
