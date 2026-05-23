import { describe, expect, it } from 'vitest'
import type { EvaluatedSegment } from './types'
import { filterSegmentsByQuery, getSegmentSearchSuggestions } from './segmentSearch'

const makeSegment = (
  overrides: Partial<EvaluatedSegment> = {},
): EvaluatedSegment => ({
  id: 'seg-1',
  name: 'Main Road East',
  curbMarking: 'YELLOW',
  confidence: 'HIGH',
  path: [
    [121.56, 25.03],
    [121.561, 25.031],
  ],
  tier: 'YELLOW',
  allowedNow: 'TEMP_STOP',
  reasonCodes: [],
  reasons: [],
  timeWindows: [],
  coverageConfidence: 'HIGH',
  overrideConfidence: 'HIGH',
  finalConfidence: 'HIGH',
  sourceReliability: 'HIGH',
  dataFreshnessDays: 3,
  ...overrides,
})

describe('filterSegmentsByQuery', () => {
  const segments = [
    makeSegment({ id: 'seg-1', name: 'Main Road East' }),
    makeSegment({ id: 'seg-2', name: 'River Street', tier: 'GREEN', allowedNow: 'PARK' }),
    makeSegment({
      id: 'inf-1',
      name: 'Market Lane',
      sourceType: 'INFERRED',
    }),
  ]

  it('returns all segments when the query is empty', () => {
    expect(filterSegmentsByQuery(segments, '')).toEqual(segments)
  })

  it('matches segment names case-insensitively', () => {
    expect(filterSegmentsByQuery(segments, 'river')).toEqual([segments[1]])
  })

  it('matches across multiple query tokens', () => {
    expect(filterSegmentsByQuery(segments, 'main east')).toEqual([segments[0]])
  })

  it('matches inferred segments by inferred label', () => {
    expect(filterSegmentsByQuery(segments, 'inferred')).toEqual([segments[2]])
  })

  it('ranks exact and prefix name matches first for suggestions', () => {
    const exactSegment = makeSegment({ id: 'seg-3', name: 'Main' })
    const prefixSegment = makeSegment({ id: 'seg-4', name: 'Main Plaza' })
    const infixSegment = makeSegment({ id: 'seg-5', name: 'Old Main Connector' })

    expect(
      getSegmentSearchSuggestions(
        [infixSegment, prefixSegment, exactSegment],
        'main',
      ).map((segment) => segment.id),
    ).toEqual(['seg-3', 'seg-4', 'seg-5'])
  })
})
