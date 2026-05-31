import { describe, expect, it } from 'vitest'
import { buildRateDropIssues } from './diffPackRateIssues'

describe('diffPackRateIssues', () => {
  it('builds curb-marking and restriction drop warnings when rates regress enough', () => {
    expect(
      buildRateDropIssues({
        districtId: 'beta',
        curbMarkingKnownRate: { prev: 0.8, next: 0.6, delta: -0.2, deltaPct: -0.25 },
        restrictionTriggeredRate: { prev: 0.2, next: 0.18, delta: -0.02, deltaPct: -0.1 },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_CURB_MARKING_DROP', 'DIFF_RESTRICTION_DROP'])
  })
})
