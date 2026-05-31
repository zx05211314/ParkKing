import { describe, expect, it } from 'vitest'
import { computeReasonCodePct, deltaPct, severityForDelta } from './compareBaselineShared'

describe('deltaPct', () => {
  it('handles zero baselines without division errors', () => {
    expect(deltaPct(0, 0)).toBe(0)
    expect(deltaPct(5, 0)).toBe(100)
  })
})

describe('severityForDelta', () => {
  it('promotes warn and fail ranges consistently', () => {
    expect(severityForDelta(5, 10)).toBe('INFO')
    expect(severityForDelta(11, 10)).toBe('WARN')
    expect(severityForDelta(25, 10)).toBe('FAIL')
  })
})

describe('computeReasonCodePct', () => {
  it('uses a safe denominator when total is zero', () => {
    expect(computeReasonCodePct({ A: 2 }, 0)).toEqual({ A: 200 })
  })
})
