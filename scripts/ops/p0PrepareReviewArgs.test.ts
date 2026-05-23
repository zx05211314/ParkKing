import { describe, expect, it } from 'vitest'
import { parseP0PrepareReviewArgs } from './p0PrepareReviewArgs'

describe('parseP0PrepareReviewArgs', () => {
  it('parses P0 prepare review options', () => {
    const parsed = parseP0PrepareReviewArgs([
      'node',
      'p0PrepareReview',
      '--district',
      'xinyi',
      '--source',
      '.tmp/source.csv',
      '--manifest',
      '.tmp/source.manifest.json',
      '--config',
      'configs/prod/xinyi.json',
      '--next-review-out',
      '.tmp/next.csv',
      '--checklist-out',
      '.tmp/next.md',
      '--geojson-out',
      '.tmp/next.geojson',
      '--merged-out',
      '.tmp/merged.csv',
      '--next-review-limit',
      '4',
      '--json',
    ])

    expect(parsed).toEqual({
      districtId: 'xinyi',
      sourcePath: '.tmp/source.csv',
      manifestPath: '.tmp/source.manifest.json',
      configPath: 'configs/prod/xinyi.json',
      nextReviewOutPath: '.tmp/next.csv',
      checklistOutPath: '.tmp/next.md',
      geojsonOutPath: '.tmp/next.geojson',
      mergedOutPath: '.tmp/merged.csv',
      nextReviewRowsLimit: 4,
      json: true,
    })
  })

  it('rejects non-integer next review limits', () => {
    expect(() =>
      parseP0PrepareReviewArgs([
        'node',
        'p0PrepareReview',
        '--next-review-limit',
        '1.5',
      ]),
    ).toThrow('next-review-limit must be a non-negative integer')
  })
})
