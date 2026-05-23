import { describe, expect, it } from 'vitest'
import { parseQaReviewGeojsonArgs } from './qaReviewGeojsonArgs'

describe('parseQaReviewGeojsonArgs', () => {
  it('parses QA review GeoJSON options', () => {
    const parsed = parseQaReviewGeojsonArgs([
      'node',
      'qaReviewGeojson',
      '--input',
      'next-review.csv',
      '--out',
      'next-review.geojson',
      '--json',
    ])

    expect(parsed).toEqual({
      inputPath: 'next-review.csv',
      outPath: 'next-review.geojson',
      json: true,
    })
  })
})
