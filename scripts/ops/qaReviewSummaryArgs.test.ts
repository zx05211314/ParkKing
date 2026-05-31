import { describe, expect, it } from 'vitest'
import { parseQaReviewSummaryArgs } from './qaReviewSummaryArgs'

describe('parseQaReviewSummaryArgs', () => {
  it('parses gate requirements and output flags', () => {
    const parsed = parseQaReviewSummaryArgs([
      'node',
      'qaReviewSummary',
      '--input',
      'review.csv',
      '--min-reviewed',
      '3',
      '--require-status',
      'LEGAL,ILLEGAL',
      '--require-bucket',
      'marked_space_park',
      '--min-reviewed-bucket',
      'marked_space_park=2,no_stop=1',
      '--json',
      '--out',
      'summary.json',
      '--manifest',
      'review.manifest.json',
      '--strict-manifest',
      '--strict-reviewed-rows',
      '--strict-reviewed-segments',
      '--next-review-limit',
      '5',
      '--next-review-out',
      'next-review.csv',
    ])

    expect(parsed).toMatchObject({
      inputPath: 'review.csv',
      manifestPath: 'review.manifest.json',
      strictManifest: true,
      strictReviewedRows: true,
      strictReviewedSegments: true,
      nextReviewRowsLimit: 5,
      nextReviewOutPath: 'next-review.csv',
      minReviewed: 3,
      requireStatuses: ['LEGAL', 'ILLEGAL'],
      requireBuckets: ['marked_space_park'],
      minReviewedBuckets: { marked_space_park: 2, no_stop: 1 },
      json: true,
      outPath: 'summary.json',
    })
  })

  it('rejects invalid required statuses', () => {
    expect(() =>
      parseQaReviewSummaryArgs([
        'node',
        'qaReviewSummary',
        '--input',
        'review.csv',
        '--require-status',
        'MAYBE',
      ]),
    ).toThrow('require-status must be LEGAL, ILLEGAL, or UNCLEAR')
  })

  it('rejects invalid bucket minimums', () => {
    expect(() =>
      parseQaReviewSummaryArgs([
        'node',
        'qaReviewSummary',
        '--input',
        'review.csv',
        '--min-reviewed-bucket',
        'marked_space_park=one',
      ]),
    ).toThrow(
      'min-reviewed-bucket must use bucket=count with a non-negative integer count',
    )
  })
})
