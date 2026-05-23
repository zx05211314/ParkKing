import { describe, expect, it } from 'vitest'
import { formatP0PrepareReview } from './p0PrepareReviewOutput'
import type { P0PrepareReviewResult } from './p0PrepareReviewTypes'

const buildResult = (): P0PrepareReviewResult => ({
  pass: true,
  inputs: {
    districtId: 'xinyi',
    sourcePath: '.tmp/xinyi-review.csv',
    manifestPath: null,
    configPath: 'configs/prod/xinyi.json',
    nextReviewOutPath: '.tmp/xinyi-next-review.csv',
    checklistOutPath: '.tmp/xinyi-next-review.md',
    geojsonOutPath: '.tmp/xinyi-next-review.geojson',
    mergedOutPath: '.tmp/xinyi-review.merged.csv',
    nextReviewRowsLimit: 4,
  },
  qaReview: {
    inputPath: '.tmp/xinyi-review.csv',
    manifest: null,
    totalRows: 80,
    reviewedRows: 0,
    validReviewedRows: 0,
    pendingRows: 80,
    invalidStatusRows: 0,
    missingIdentityRows: 0,
    duplicateReviewedSegments: 0,
    duplicateReviewedRows: 0,
    conflictingReviewedSegments: 0,
    statusCounts: {},
    reviewSourceCounts: { pending: 80 },
    bucketCounts: { marked_space_park: 14 },
    reviewedBucketCounts: {},
    districtCounts: { xinyi: 80 },
    reviewRequirements: {
      minReviewedRemaining: 1,
      estimatedMinimumNewReviews: 4,
      missingStatuses: ['LEGAL', 'ILLEGAL'],
      missingBuckets: ['marked_space_park'],
      bucketMinimumsRemaining: {
        marked_space_park: 2,
        no_stop: 2,
      },
    },
    nextReviewRows: [],
    errors: ['Valid reviewed rows 0 is below required minimum 1.'],
    warnings: [],
    pass: false,
  },
  fatalReviewErrors: [],
  nextReviewRowsWritten: 4,
  checklist: null,
  geojson: null,
  errors: [],
  warnings: [],
})

describe('formatP0PrepareReview', () => {
  it('formats prepared artifacts separately from review blockers', () => {
    const output = formatP0PrepareReview(buildResult())

    expect(output).toContain('# P0 Prepare Review: PASS')
    expect(output).toContain('- Status: BLOCKED')
    expect(output).toContain('Handoff CSV: 4 row(s)')
    expect(output).toContain('Valid reviewed rows 0 is below required minimum 1.')
    expect(output).toContain('Finalize after review: `npm run ops:p0-finalize-review')
    expect(output).toContain('--source ".tmp/xinyi-review.csv"')
    expect(output).toContain('--reviews ".tmp/xinyi-next-review.csv"')
    expect(output).toContain('--merged-out ".tmp/xinyi-review.merged.csv"')
  })
})
