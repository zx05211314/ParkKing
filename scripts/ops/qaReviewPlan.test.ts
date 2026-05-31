import { describe, expect, it } from 'vitest'
import {
  buildQaReviewPlanAssignments,
  buildQaReviewPlanLines,
} from './qaReviewPlan'
import type { QaReviewSummary } from './qaReviewSummaryTypes'

const buildSummary = (overrides: Partial<QaReviewSummary> = {}): QaReviewSummary => ({
  inputPath: 'review.csv',
  manifest: null,
  totalRows: 4,
  reviewedRows: 0,
  validReviewedRows: 0,
  pendingRows: 4,
  invalidStatusRows: 0,
  missingIdentityRows: 0,
  duplicateReviewedSegments: 0,
  duplicateReviewedRows: 0,
  conflictingReviewedSegments: 0,
  statusCounts: {},
  reviewSourceCounts: { pending: 4 },
  bucketCounts: { marked_space_park: 2, no_stop: 2 },
  reviewedBucketCounts: {},
  districtCounts: { xinyi: 4 },
  reviewRequirements: {
    minReviewedRemaining: 1,
    estimatedMinimumNewReviews: 4,
    missingStatuses: ['LEGAL', 'ILLEGAL'],
    missingBuckets: ['marked_space_park'],
    bucketMinimumsRemaining: { marked_space_park: 2, no_stop: 2 },
  },
  nextReviewRows: [
    {
      rowNumber: 2,
      districtId: 'xinyi',
      segmentId: 'seg-1',
      reviewBucket: 'marked_space_park',
      lat: '25.0',
      lon: '121.5',
      score: '5',
      tier: 'GREEN',
      allowedNow: 'PARK',
      parkingSpaceCount: '2',
      mapsUrl: null,
      streetViewUrl: null,
    },
    {
      rowNumber: 3,
      districtId: 'xinyi',
      segmentId: 'seg-2',
      reviewBucket: 'marked_space_park',
      lat: '25.1',
      lon: '121.6',
      score: '4',
      tier: 'GREEN',
      allowedNow: 'PARK',
      parkingSpaceCount: '3',
      mapsUrl: null,
      streetViewUrl: null,
    },
    {
      rowNumber: 4,
      districtId: 'xinyi',
      segmentId: 'seg-3',
      reviewBucket: 'no_stop',
      lat: '25.2',
      lon: '121.7',
      score: '-1',
      tier: 'RED',
      allowedNow: 'NO_STOP',
      parkingSpaceCount: '0',
      mapsUrl: null,
      streetViewUrl: null,
    },
    {
      rowNumber: 5,
      districtId: 'xinyi',
      segmentId: 'seg-4',
      reviewBucket: 'no_stop',
      lat: '25.3',
      lon: '121.8',
      score: '-2',
      tier: 'RED',
      allowedNow: 'NO_STOP',
      parkingSpaceCount: '0',
      mapsUrl: null,
      streetViewUrl: null,
    },
  ],
  errors: [],
  warnings: [],
  pass: false,
  ...overrides,
})

describe('buildQaReviewPlanLines', () => {
  it('selects concrete bucket rows and keeps status coverage evidence-based', () => {
    const lines = buildQaReviewPlanLines(buildSummary())

    expect(lines).toContain('- Minimum new reviewed rows needed: 4')
    expect(lines).toContain(
      '- Status coverage still needs: LEGAL, ILLEGAL; fill reviewStatus only after checking sign/curb evidence.',
    )
    expect(lines).toContain(
      '- Bucket marked_space_park: review 2; suggested row 2 (marked_space_park seg-1), row 3 (marked_space_park seg-2).',
    )
    expect(lines).toContain(
      '- Bucket no_stop: review 2; suggested row 4 (no_stop seg-3), row 5 (no_stop seg-4).',
    )
  })

  it('reports when no more review rows are required', () => {
    const lines = buildQaReviewPlanLines(
      buildSummary({
        reviewRequirements: {
          minReviewedRemaining: 0,
          estimatedMinimumNewReviews: 0,
          missingStatuses: [],
          missingBuckets: [],
          bucketMinimumsRemaining: {},
        },
        nextReviewRows: [],
        pass: true,
      }),
    )

    expect(lines).toEqual(['- No additional review rows required by configured thresholds.'])
  })

  it('assigns stable handoff priority metadata to selected rows', () => {
    const assignments = buildQaReviewPlanAssignments(buildSummary())

    expect(assignments.get(2)).toEqual({
      rank: 1,
      reasons: ['bucket:marked_space_park'],
    })
    expect(assignments.get(4)).toEqual({
      rank: 3,
      reasons: ['bucket:no_stop'],
    })
    expect(assignments.has(99)).toBe(false)
  })
})
