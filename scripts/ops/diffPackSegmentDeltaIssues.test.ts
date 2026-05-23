import { describe, expect, it } from 'vitest'
import { buildSegmentDeltaIssues } from './diffPackSegmentDeltaIssues'

describe('diffPackSegmentDeltaIssues', () => {
  it('emits zero and percent-delta issues when segments collapse', () => {
    expect(
      buildSegmentDeltaIssues({
        districtId: 'beta',
        segmentsCount: { prev: 10, next: 0, delta: -10, deltaPct: -1 },
      }).map((issue) => issue.code),
    ).toEqual(['DIFF_SEGMENTS_ZERO', 'DIFF_SEGMENTS_DELTA_PCT'])
  })
})
