import { describe, expect, it } from 'vitest'
import { isValidReviewTimestamp, normalizeReviewTimestamp } from './reviewTimestamp'

describe('reviewTimestamp', () => {
  it('accepts ISO timestamps with explicit timezone', () => {
    expect(isValidReviewTimestamp('2026-05-22T12:00:00Z')).toBe(true)
    expect(isValidReviewTimestamp('2026-05-22T12:00:00.000Z')).toBe(true)
    expect(isValidReviewTimestamp('2026-05-22T20:00:00+08:00')).toBe(true)
  })

  it('rejects ambiguous or invalid timestamps', () => {
    expect(isValidReviewTimestamp('2026-05-22')).toBe(false)
    expect(isValidReviewTimestamp('2026-05-22T12:00:00')).toBe(false)
    expect(isValidReviewTimestamp('not-a-date')).toBe(false)
    expect(isValidReviewTimestamp('1')).toBe(false)
  })

  it('normalizes finite numeric timestamps for legacy report payloads', () => {
    expect(normalizeReviewTimestamp(Date.UTC(2026, 4, 22, 12, 0, 0))).toBe(
      '2026-05-22T12:00:00.000Z',
    )
    expect(normalizeReviewTimestamp(Number.NaN)).toBeNull()
  })
})
