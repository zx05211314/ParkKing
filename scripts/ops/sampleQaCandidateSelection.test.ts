import { describe, expect, it } from 'vitest'
import type { EvaluatedSegment } from '../../src/ui/types'
import { getQaReviewBucket, selectQaCandidateRows } from './sampleQaCandidateSelection'

const buildSegment = (params: {
  id: string
  rankScore: number
  path: [number, number][]
  reasonCodes?: string[]
  source?: string
  sourceType?: EvaluatedSegment['sourceType']
  allowedNow?: EvaluatedSegment['allowedNow']
  tier?: EvaluatedSegment['tier']
  parkingSpaceCount?: number
}): EvaluatedSegment =>
  ({
    id: params.id,
    name: params.id,
    curbMarking: 'RED',
    confidence: 'HIGH',
    path: params.path,
    source: params.source,
    sourceType: params.sourceType,
    riskTags: [],
    tier: params.tier ?? 'RED',
    allowedNow: params.allowedNow ?? 'NO_STOP',
    reasonCodes: (params.reasonCodes ?? ['RULE_RED_NO_STOP']) as EvaluatedSegment['reasonCodes'],
    reasons: [],
    timeWindows: [],
    coverageConfidence: 'HIGH',
    overrideConfidence: 'HIGH',
    finalConfidence: 'HIGH',
    sourceReliability: 'HIGH',
    dataFreshnessDays: 0,
    parkingSpaceCount: params.parkingSpaceCount,
    rankScore: params.rankScore,
  }) as EvaluatedSegment

describe('selectQaCandidateRows', () => {
  it('keeps input order when shuffle is disabled', () => {
    const rows = selectQaCandidateRows({
      districtId: 'xinyi',
      segments: [
        buildSegment({
          id: 'seg-a',
          rankScore: 9,
          path: [
            [121.5, 25.05],
            [121.5002, 25.0502],
          ],
        }),
        buildSegment({
          id: 'seg-b',
          rankScore: 8,
          path: [
            [121.6, 25.06],
            [121.6002, 25.0602],
          ],
        }),
      ],
      topN: 1,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.segmentId).toBe('seg-a')
  })

  it('shuffles deterministically when requested', () => {
    const segments = [
      buildSegment({
        id: 'seg-a',
        rankScore: 9,
        path: [
          [121.5, 25.05],
          [121.5002, 25.0502],
        ],
      }),
      buildSegment({
        id: 'seg-b',
        rankScore: 8,
        path: [
          [121.6, 25.06],
          [121.6002, 25.0602],
        ],
      }),
      buildSegment({
        id: 'seg-c',
        rankScore: 7,
        path: [
          [121.7, 25.07],
          [121.7002, 25.0702],
        ],
        source: 'INFERRED_CENTERLINE_OFFSET',
        reasonCodes: ['COVERAGE_LOW'],
      }),
    ]

    const rowsA = selectQaCandidateRows({
      districtId: 'xinyi',
      segments,
      topN: 3,
      shuffle: true,
      seed: 7,
    })
    const rowsB = selectQaCandidateRows({
      districtId: 'xinyi',
      segments,
      topN: 3,
      shuffle: true,
      seed: 7,
    })

    expect(rowsA.map((row) => row.segmentId)).toEqual(
      rowsB.map((row) => row.segmentId),
    )
    expect(rowsA).toHaveLength(3)
  })

  it('review strategy samples diverse buckets before ranked fill', () => {
    const rows = selectQaCandidateRows({
      districtId: 'xinyi',
      strategy: 'review',
      segments: [
        buildSegment({
          id: 'temp-high',
          rankScore: 10,
          allowedNow: 'TEMP_STOP',
          tier: 'YELLOW',
          reasonCodes: ['RULE_YELLOW_DAY_NO_PARK'],
          path: [
            [121.5, 25.05],
            [121.5002, 25.0502],
          ],
        }),
        buildSegment({
          id: 'no-stop',
          rankScore: 9,
          allowedNow: 'NO_STOP',
          reasonCodes: ['RULE_RED_NO_STOP'],
          path: [
            [121.6, 25.06],
            [121.6002, 25.0602],
          ],
        }),
        buildSegment({
          id: 'marked-park',
          rankScore: 8,
          allowedNow: 'PARK',
          tier: 'GREEN',
          parkingSpaceCount: 2,
          reasonCodes: ['PARKING_SPACE_EVIDENCE'],
          path: [
            [121.7, 25.07],
            [121.7002, 25.0702],
          ],
        }),
        buildSegment({
          id: 'inferred',
          rankScore: 7,
          allowedNow: 'PARK',
          tier: 'YELLOW',
          source: 'INFERRED_CENTERLINE_OFFSET',
          sourceType: 'INFERRED',
          reasonCodes: ['INFERRED_CAPPED'],
          path: [
            [121.8, 25.08],
            [121.8002, 25.0802],
          ],
        }),
        buildSegment({
          id: 'stale',
          rankScore: 6,
          allowedNow: 'TEMP_STOP',
          tier: 'YELLOW',
          reasonCodes: ['RULE_YELLOW_DAY_NO_PARK', 'DATA_FRESHNESS_STALE'],
          path: [
            [121.9, 25.09],
            [121.9002, 25.0902],
          ],
        }),
      ],
      topN: 5,
    })

    expect(rows.map((row) => row.reviewBucket)).toEqual([
      'marked_space_park',
      'no_stop',
      'inferred',
      'stale_data',
      'temp_stop',
    ])
    expect(new Set(rows.map((row) => row.segmentId)).size).toBe(rows.length)
  })

  it('classifies answer coverage before override provenance', () => {
    const markedOverride = buildSegment({
      id: 'marked-override',
      rankScore: 10,
      allowedNow: 'PARK',
      tier: 'GREEN',
      parkingSpaceCount: 4,
      reasonCodes: ['OVERRIDE_APPLIED', 'PARKING_SPACE_EVIDENCE'],
      path: [
        [121.5, 25.05],
        [121.5002, 25.0502],
      ],
    })
    const noStopOverride = buildSegment({
      id: 'no-stop-override',
      rankScore: 9,
      allowedNow: 'NO_STOP',
      reasonCodes: ['OVERRIDE_APPLIED', 'RULE_RED_NO_STOP'],
      path: [
        [121.6, 25.06],
        [121.6002, 25.0602],
      ],
    })

    expect(getQaReviewBucket(markedOverride)).toBe('marked_space_park')
    expect(getQaReviewBucket(noStopOverride)).toBe('no_stop')
  })

  it('pins required segments ahead of ranked review sampling', () => {
    const segments = [
      buildSegment({
        id: 'high',
        rankScore: 10,
        path: [[121.5, 25.05], [121.5002, 25.0502]],
      }),
      buildSegment({
        id: 'required-low',
        rankScore: -10,
        source: 'INFERRED_CENTERLINE_OFFSET',
        sourceType: 'INFERRED',
        allowedNow: 'PARK',
        tier: 'YELLOW',
        reasonCodes: ['COVERAGE_LOW'],
        path: [[121.6, 25.06], [121.6002, 25.0602]],
      }),
    ]

    const rows = selectQaCandidateRows({
      districtId: 'songshan',
      segments,
      topN: 2,
      strategy: 'review',
      requiredSegmentIds: ['required-low'],
    })

    expect(rows.map((row) => row.segmentId)).toEqual(['required-low', 'high'])
    expect(rows[0]?.reviewBucket).toBe('inferred')
  })

  it('rejects missing required segments', () => {
    expect(() =>
      selectQaCandidateRows({
        districtId: 'songshan',
        segments: [],
        topN: 1,
        requiredSegmentIds: ['missing'],
      }),
    ).toThrow('Required segments not found: missing')
  })

  it('expands a required parent id to every evaluated part', () => {
    const segments = ['part-2', 'part-1', 'part-3'].map((part, index) =>
      buildSegment({
        id: `candidate-critical-${part}`,
        rankScore: 10 - index,
        path: [[121.5 + index * 0.001, 25.05], [121.5002 + index * 0.001, 25.0502]],
      }),
    )

    const rows = selectQaCandidateRows({
      districtId: 'songshan',
      segments,
      topN: 3,
      requiredSegmentIds: ['candidate-critical', 'candidate-critical-part-1'],
    })

    expect(rows.map((row) => row.segmentId)).toEqual([
      'candidate-critical-part-1',
      'candidate-critical-part-2',
      'candidate-critical-part-3',
    ])
  })
})
