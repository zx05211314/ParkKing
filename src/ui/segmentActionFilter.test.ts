import { describe, expect, it } from 'vitest'
import {
  compareAllowedActionPriority,
  filterSegmentsByAction,
  getAllowedActionPriority,
  isSegmentActionFilter,
  segmentMatchesActionFilter,
} from './segmentActionFilter'

describe('segmentActionFilter', () => {
  it('validates known action-filter values', () => {
    expect(isSegmentActionFilter('ALL')).toBe(true)
    expect(isSegmentActionFilter('PARK_ONLY')).toBe(true)
    expect(isSegmentActionFilter('STOP_OK')).toBe(true)
    expect(isSegmentActionFilter('INVALID')).toBe(false)
  })

  it('matches allowed actions by filter mode', () => {
    expect(segmentMatchesActionFilter('PARK', 'ALL')).toBe(true)
    expect(segmentMatchesActionFilter('TEMP_STOP', 'ALL')).toBe(true)
    expect(segmentMatchesActionFilter('NO_STOP', 'ALL')).toBe(true)
    expect(segmentMatchesActionFilter('PARK', 'PARK_ONLY')).toBe(true)
    expect(segmentMatchesActionFilter('TEMP_STOP', 'PARK_ONLY')).toBe(false)
    expect(segmentMatchesActionFilter('PARK', 'STOP_OK')).toBe(true)
    expect(segmentMatchesActionFilter('TEMP_STOP', 'STOP_OK')).toBe(true)
    expect(segmentMatchesActionFilter('NO_STOP', 'STOP_OK')).toBe(false)
  })

  it('filters segment collections by allowed action', () => {
    const segments = [
      { id: 'a', allowedNow: 'PARK' as const },
      { id: 'b', allowedNow: 'TEMP_STOP' as const },
      { id: 'c', allowedNow: 'NO_STOP' as const },
    ]

    expect(filterSegmentsByAction(segments, 'ALL').map((segment) => segment.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(
      filterSegmentsByAction(segments, 'STOP_OK').map((segment) => segment.id),
    ).toEqual(['a', 'b'])
    expect(
      filterSegmentsByAction(segments, 'PARK_ONLY').map((segment) => segment.id),
    ).toEqual(['a'])
  })

  it('prioritizes park over temp stop over no stop', () => {
    expect(getAllowedActionPriority('PARK')).toBe(0)
    expect(getAllowedActionPriority('TEMP_STOP')).toBe(1)
    expect(getAllowedActionPriority('NO_STOP')).toBe(2)
    expect(compareAllowedActionPriority('PARK', 'TEMP_STOP')).toBeLessThan(0)
    expect(compareAllowedActionPriority('TEMP_STOP', 'NO_STOP')).toBeLessThan(0)
  })
})
