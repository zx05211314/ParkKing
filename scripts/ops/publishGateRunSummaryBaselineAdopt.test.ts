import { describe, expect, it } from 'vitest'
import { buildPublishGateBaselineAdoptSummary } from './publishGateRunSummaryBaselineAdopt'

describe('publishGateRunSummaryBaselineAdopt', () => {
  it('projects baseline-adopt state into the run summary section', () => {
    expect(
      buildPublishGateBaselineAdoptSummary({
        allowBaselineAdopt: true,
        baselineAdoptState: {
          checkedDistricts: [],
          applied: true,
          districtIds: ['xinyi'],
          gateMessageFlags: ['BASELINE_ADOPT_APPLIED'],
        },
      }),
    ).toEqual({
      enabled: true,
      applied: true,
      districtIds: ['xinyi'],
      reason: 'baseline_adopt',
    })
  })
})
