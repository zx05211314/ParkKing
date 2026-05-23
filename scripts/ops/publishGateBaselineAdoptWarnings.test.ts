import { describe, expect, it } from 'vitest'
import {
  collectPublishGateFailWarnings,
  splitPublishGateAdoptableFails,
} from './publishGateBaselineAdoptWarnings'

describe('publishGateBaselineAdoptWarnings', () => {
  it('collects fail warnings and separates adoptable diff fails from hard fails', () => {
    const matches = collectPublishGateFailWarnings([
      {
        districtId: 'xinyi',
        warnings: [
          { severity: 'FAIL', code: 'DIFF_SEGMENT_COUNT_DELTA', message: 'adoptable' },
          { severity: 'FAIL', code: 'DIFF_SEGMENTS_ZERO', message: 'hard diff fail' },
          { severity: 'WARN', code: 'COUNT_DELTA', message: 'warn' },
        ],
      },
    ])

    const result = splitPublishGateAdoptableFails(matches)

    expect(result.adoptableDiffFails).toHaveLength(1)
    expect(result.nonAdoptableFails).toHaveLength(1)
    expect(result.adoptableDiffFails[0]?.warning.code).toBe('DIFF_SEGMENT_COUNT_DELTA')
    expect(result.nonAdoptableFails[0]?.warning.code).toBe('DIFF_SEGMENTS_ZERO')
  })
})
