import { describe, expect, it } from 'vitest'
import { validatePublishGateOverrideCount } from './publishGateOverrideCounts'

describe('publishGateOverrideCounts', () => {
  it('flags metadata count mismatches', () => {
    expect(
      validatePublishGateOverrideCount({
        districtId: 'xinyi',
        overridesCount: 1,
        counts: { overridesApplied: 2 },
      }).map((warning) => warning.code),
    ).toEqual(['OVERRIDES_COUNT_MISMATCH'])
  })
})
