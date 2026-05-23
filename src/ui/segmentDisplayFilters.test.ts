import { describe, expect, it } from 'vitest'
import {
  buildActionFilteredSegmentState,
  countIllegalFeedbackHidden,
  filterFeedbackIllegalSegments,
  getSearchableSegments,
} from './segmentDisplayFilters'
import type { SegmentListItem } from './segmentListTypes'

const segments: SegmentListItem[] = [
  {
    id: 'seg-a',
    name: 'A',
    curbMarking: 'YELLOW',
    confidence: 'MEDIUM',
    path: [
      [121.56, 25.03],
      [121.5602, 25.0302],
    ],
    allowedNow: 'PARK',
    reasonCodes: [],
    reasons: [],
    timeWindows: [],
    coverageConfidence: 'HIGH',
    overrideConfidence: 'HIGH',
    finalConfidence: 'HIGH',
    sourceReliability: 'HIGH',
    dataFreshnessDays: 5,
    tier: 'GREEN',
    parkingSpaceCount: 2,
  },
  {
    id: 'seg-b',
    name: 'B',
    curbMarking: 'RED',
    confidence: 'MEDIUM',
    path: [
      [121.57, 25.04],
      [121.5702, 25.0402],
    ],
    allowedNow: 'NO_STOP',
    reasonCodes: ['RULE_RED_NO_STOP'],
    reasons: [],
    timeWindows: [],
    coverageConfidence: 'HIGH',
    overrideConfidence: 'HIGH',
    finalConfidence: 'HIGH',
    sourceReliability: 'HIGH',
    dataFreshnessDays: 5,
    tier: 'RED',
    parkingSpaceCount: 0,
  },
]

describe('segmentDisplayFilters', () => {
  it('counts and filters locally illegal segments', () => {
    const reportsBySegment = {
      'seg-b': { status: 'ILLEGAL' as const },
    }

    expect(countIllegalFeedbackHidden(segments, true, reportsBySegment)).toBe(1)
    expect(filterFeedbackIllegalSegments(segments, true, reportsBySegment)).toEqual([
      segments[0],
    ])
  })

  it('builds action-filter state and searchable segments', () => {
    const { actionFilteredSegments, actionFilterHiddenCount, actionFilteredMarkedSpaceSegmentCount } =
      buildActionFilteredSegmentState(segments, 'STOP_OK')

    expect(actionFilteredSegments).toEqual([segments[0]])
    expect(actionFilterHiddenCount).toBe(1)
    expect(actionFilteredMarkedSpaceSegmentCount).toBe(1)
    expect(getSearchableSegments(actionFilteredSegments, true)).toEqual([segments[0]])
  })
})
