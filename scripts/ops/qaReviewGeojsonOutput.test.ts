import { describe, expect, it } from 'vitest'
import { formatQaReviewGeojson } from './qaReviewGeojsonOutput'

describe('formatQaReviewGeojson', () => {
  it('formats review map layer status', () => {
    const output = formatQaReviewGeojson({
      inputPath: 'next-review.csv',
      outPath: 'next-review.geojson',
      totalRows: 2,
      featureCount: 1,
      skippedRows: 1,
      collection: {
        type: 'FeatureCollection',
        features: [],
      },
      errors: [],
      warnings: ['row skipped'],
      pass: true,
    })

    expect(output).toContain('# QA Review GeoJSON: PASS')
    expect(output).toContain('- Features: 1')
    expect(output).toContain('Load the GeoJSON in a map viewer')
    expect(output).toContain('row skipped')
  })
})
