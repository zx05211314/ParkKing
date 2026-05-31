import { describe, expect, it } from 'vitest'
import { shouldUseMainThreadDegradedEvaluation } from './useSegmentEvaluationState'

describe('shouldUseMainThreadDegradedEvaluation', () => {
  it('uses degraded main-thread evaluation for large zone-aware browser datasets', () => {
    expect(
      shouldUseMainThreadDegradedEvaluation({
        useWorker: true,
        segmentCount: 2_001,
        zoneCount: 1,
      }),
    ).toBe(true)
  })

  it('keeps the worker path for small, zoned datasets', () => {
    expect(
      shouldUseMainThreadDegradedEvaluation({
        useWorker: true,
        segmentCount: 2_000,
        zoneCount: 1,
      }),
    ).toBe(false)
  })

  it('does not force degraded evaluation when zones or workers are disabled', () => {
    expect(
      shouldUseMainThreadDegradedEvaluation({
        useWorker: true,
        segmentCount: 2_001,
        zoneCount: 0,
      }),
    ).toBe(false)
    expect(
      shouldUseMainThreadDegradedEvaluation({
        useWorker: false,
        segmentCount: 2_001,
        zoneCount: 1,
      }),
    ).toBe(false)
  })
})
