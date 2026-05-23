import { describe, expect, it } from 'vitest'
import { parseQaReviewApplyArgs } from './qaReviewApplyArgs'

describe('parseQaReviewApplyArgs', () => {
  it('parses QA review apply options', () => {
    const parsed = parseQaReviewApplyArgs([
      'node',
      'qaReviewApply',
      '--source',
      'review.csv',
      '--reviews',
      'next-review.csv',
      '--out',
      'merged.csv',
      '--allow-overwrite',
      '--json',
    ])

    expect(parsed).toEqual({
      sourcePath: 'review.csv',
      reviewsPath: 'next-review.csv',
      outPath: 'merged.csv',
      allowOverwrite: true,
      json: true,
    })
  })
})
