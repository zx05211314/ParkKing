import { describe, expect, it } from 'vitest'
import { parseP0FinalizeReviewArgs } from './p0FinalizeReviewArgs'

describe('parseP0FinalizeReviewArgs', () => {
  it('parses finalize review CLI options', () => {
    expect(
      parseP0FinalizeReviewArgs([
        'node',
        'p0FinalizeReview',
        '--district',
        'xinyi',
        '--source',
        '.tmp/source.csv',
        '--reviews',
        '.tmp/reviews.csv',
        '--merged-out',
        '.tmp/merged.csv',
        '--config',
        'configs/prod/xinyi.json',
        '--answer-cases',
        'configs/prod/xinyi.answer-cases.json',
        '--out-dir',
        'data/overrides',
        '--publish-report',
        'public/data/generated/ingest_all_report.json',
        '--no-cleanup',
        '--allow-publish-warn',
        '--allow-publish-fail',
        '--publish-override',
        'P0 bootstrap',
        '--json',
      ]),
    ).toEqual({
      districtId: 'xinyi',
      sourcePath: '.tmp/source.csv',
      reviewsPath: '.tmp/reviews.csv',
      mergedOutPath: '.tmp/merged.csv',
      configPath: 'configs/prod/xinyi.json',
      answerCasesPath: 'configs/prod/xinyi.answer-cases.json',
      outDir: 'data/overrides',
      publishReportPath: 'public/data/generated/ingest_all_report.json',
      noCleanup: true,
      allowPublishWarn: true,
      allowPublishFail: true,
      publishOverrideReason: 'P0 bootstrap',
      json: true,
    })
  })
})
