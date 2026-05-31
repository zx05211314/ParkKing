import { describe, expect, it } from 'vitest'
import { parseQaReviewGateArgs } from './qaReviewGateArgs'

describe('parseQaReviewGateArgs', () => {
  it('parses review gate options', () => {
    const parsed = parseQaReviewGateArgs([
      'node',
      'qaReviewGate',
      '--input',
      'review.csv',
      '--config',
      'configs/prod/xinyi.json',
      '--outDir',
      '.tmp/overrides',
      '--min-reviewed',
      '2',
      '--require-status',
      'LEGAL,ILLEGAL',
      '--require-bucket',
      'marked_space_park',
      '--min-reviewed-bucket',
      'marked_space_park=2,no_stop=1',
      '--json',
      '--out',
      'gate.json',
      '--manifest',
      'review.manifest.json',
      '--allow-manifest-warnings',
      '--allow-config-provenance-warnings',
      '--allow-invalid-reviewed-rows',
      '--allow-duplicate-reviewed-segments',
      '--next-review-limit',
      '5',
      '--next-review-out',
      'next-review.csv',
    ])

    expect(parsed).toMatchObject({
      inputPath: 'review.csv',
      manifestPath: 'review.manifest.json',
      configPath: 'configs/prod/xinyi.json',
      outDir: '.tmp/overrides',
      strictManifest: false,
      strictConfigProvenance: false,
      strictReviewedRows: false,
      strictReviewedSegments: false,
      nextReviewRowsLimit: 5,
      nextReviewOutPath: 'next-review.csv',
      minReviewed: 2,
      requireStatuses: ['LEGAL', 'ILLEGAL'],
      requireBuckets: ['marked_space_park'],
      minReviewedBuckets: { marked_space_park: 2, no_stop: 1 },
      json: true,
      outPath: 'gate.json',
    })
  })

  it('rejects invalid required statuses', () => {
    expect(() =>
      parseQaReviewGateArgs([
        'node',
        'qaReviewGate',
        '--input',
        'review.csv',
        '--config',
        'config.json',
        '--require-status',
        'MAYBE',
      ]),
    ).toThrow('require-status must be LEGAL, ILLEGAL, or UNCLEAR')
  })

  it('rejects invalid bucket minimums', () => {
    expect(() =>
      parseQaReviewGateArgs([
        'node',
        'qaReviewGate',
        '--input',
        'review.csv',
        '--config',
        'config.json',
        '--min-reviewed-bucket',
        'marked_space_park',
      ]),
    ).toThrow('min-reviewed-bucket must use bucket=count')
  })
})
