import { describe, expect, it } from 'vitest'
import { buildBaselineCounts } from './generateBaselineRecordCounts'

describe('generateBaselineRecordCounts', () => {
  it('defaults missing count fields to zero', () => {
    expect(buildBaselineCounts({ counts: { segments: 4 } })).toEqual({
      segments: 4,
      intersections: 0,
      inferredCandidates: 0,
      signOverrides: 0,
      signOverrideUnmatchedNamedCount: 0,
    })
  })
})
