import { describe, expect, it } from 'vitest'
import { parseP0PromoteReviewArgs } from './p0PromoteReviewArgs'

describe('parseP0PromoteReviewArgs', () => {
  it('parses P0 promote review options', () => {
    const parsed = parseP0PromoteReviewArgs([
      'node',
      'p0PromoteReview',
      '--district',
      'xinyi',
      '--source',
      '.tmp/xinyi-review.csv',
      '--reviews',
      '.tmp/xinyi-next-review.csv',
      '--merged-out',
      '.tmp/xinyi-review.merged.csv',
      '--config',
      'configs/prod/xinyi.json',
      '--out-dir',
      'data/overrides',
      '--json',
    ])

    expect(parsed).toEqual({
      districtId: 'xinyi',
      sourcePath: '.tmp/xinyi-review.csv',
      reviewsPath: '.tmp/xinyi-next-review.csv',
      mergedOutPath: '.tmp/xinyi-review.merged.csv',
      configPath: 'configs/prod/xinyi.json',
      outDir: 'data/overrides',
      json: true,
    })
  })
})
