import { describe, expect, it } from 'vitest'
import {
  formatRelativeAge,
  formatRelativeDelay,
  parseTimestampMs,
} from './syncStatusRuntimeFormatting'

describe('syncStatusRuntimeFormatting', () => {
  it('formats relative ages and delays across thresholds', () => {
    const nowMs = Date.parse('2026-03-20T12:00:00.000Z')

    expect(formatRelativeAge(nowMs - 15_000, nowMs)).toBe('just now')
    expect(formatRelativeAge(nowMs - 5 * 60_000, nowMs)).toBe('5 min ago')
    expect(formatRelativeAge(nowMs - 2 * 3_600_000, nowMs)).toBe('2 hr ago')
    expect(formatRelativeAge(nowMs - 3 * 86_400_000, nowMs)).toBe('3 d ago')

    expect(formatRelativeDelay(nowMs + 15_000, nowMs)).toBe('now')
    expect(formatRelativeDelay(nowMs + 5 * 60_000, nowMs)).toBe('in 5 min')
    expect(formatRelativeDelay(nowMs + 2 * 3_600_000, nowMs)).toBe('in 2 hr')
    expect(formatRelativeDelay(nowMs + 3 * 86_400_000, nowMs)).toBe('in 3 d')
  })

  it('parses timestamps safely', () => {
    expect(parseTimestampMs('2026-03-20T12:00:00.000Z')).toBeTypeOf('number')
    expect(parseTimestampMs('not-a-date')).toBeNull()
    expect(parseTimestampMs(null)).toBeNull()
  })
})
