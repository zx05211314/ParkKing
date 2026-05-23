import { describe, expect, it } from 'vitest'
import { buildPublishGateBootstrapSummary } from './publishGateRunSummaryBootstrap'

describe('publishGateRunSummaryBootstrap', () => {
  it('projects bootstrap state into the run summary bootstrap section', () => {
    expect(
      buildPublishGateBootstrapSummary({
        requested: true,
        previousPackExists: false,
        modeUsed: true,
        denied: false,
        effectiveAllowFail: true,
        gateMessageFlags: ['BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH'],
      }),
    ).toEqual({
      requested: true,
      modeUsed: true,
      denied: false,
      previousPackExists: false,
    })
  })
})
