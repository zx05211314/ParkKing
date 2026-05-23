import { describe, expect, it } from 'vitest'
import { buildPublishGateOptionsFromArgs } from './publishGateCliOptions'

describe('publishGateCliOptions', () => {
  it('maps parsed cli args into publish gate options', () => {
    expect(
      buildPublishGateOptionsFromArgs({
        reportPath: 'report.json',
        mode: 'warn',
        allowWarn: true,
        allowFail: false,
        allowBaselineAdopt: true,
        overrideReason: 'ack',
        datasetRootDir: 'data/generated',
      }),
    ).toEqual({
      reportPath: 'report.json',
      mode: 'warn',
      allowWarn: true,
      allowFail: false,
      allowBaselineAdopt: true,
      overrideReason: 'ack',
      datasetRootDir: 'data/generated',
    })
  })
})
