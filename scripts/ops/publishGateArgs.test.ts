import { describe, expect, it } from 'vitest'
import { parsePublishGateArgs } from './publishGateArgs'

describe('parsePublishGateArgs', () => {
  it('parses supported flags', () => {
    expect(
      parsePublishGateArgs([
        'node',
        'publishGate.ts',
        '--report',
        'report.json',
        '--mode',
        'warn',
        '--override',
        'acknowledged',
        '--datasetRoot',
        'data/generated',
        '--allowWarn',
        '--allowFail',
        '--allowBaselineAdopt',
      ]),
    ).toEqual({
      reportPath: 'report.json',
      mode: 'warn',
      allowWarn: true,
      allowFail: true,
      allowBaselineAdopt: true,
      overrideReason: 'acknowledged',
      datasetRootDir: 'data/generated',
    })
  })

  it('returns null and false defaults when flags are absent', () => {
    expect(parsePublishGateArgs(['node', 'publishGate.ts'])).toEqual({
      reportPath: null,
      mode: null,
      allowWarn: false,
      allowFail: false,
      allowBaselineAdopt: false,
      overrideReason: null,
      datasetRootDir: null,
    })
  })
})
