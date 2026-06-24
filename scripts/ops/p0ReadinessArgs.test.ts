import { describe, expect, it } from 'vitest'
import { parseP0ReadinessArgs } from './p0ReadinessArgs'

describe('parseP0ReadinessArgs', () => {
  it('parses P0 readiness options', () => {
    const parsed = parseP0ReadinessArgs([
      'node',
      'p0Readiness',
      '--district',
      'xinyi',
      '--dataset-dir',
      'public/data/generated/xinyi',
      '--review',
      '.tmp/xinyi-review.csv',
      '--manifest',
      '.tmp/xinyi-review.manifest.json',
      '--config',
      'configs/prod/xinyi.json',
      '--publish-report',
      'public/data/generated/ingest_all_report.json',
      '--answer-cases',
      'configs/prod/xinyi.answer-cases.json',
      '--hhmm',
      '21:00',
      '--radius',
      '25',
      '--next-review-limit',
      '4',
      '--allow-publish-warn',
      '--allow-publish-fail',
      '--publish-override',
      'P0 bootstrap',
      '--allow-mismatched-case-hash',
      '--json',
    ])

    expect(parsed).toEqual({
      districtId: 'xinyi',
      datasetDir: 'public/data/generated/xinyi',
      reviewPath: '.tmp/xinyi-review.csv',
      manifestPath: '.tmp/xinyi-review.manifest.json',
      configPath: 'configs/prod/xinyi.json',
      publishReportPath: 'public/data/generated/ingest_all_report.json',
      answerCasesPath: 'configs/prod/xinyi.answer-cases.json',
      hhmm: '21:00',
      searchRadiusMeters: 25,
      nextReviewRowsLimit: 4,
      allowPublishWarn: true,
      allowPublishFail: true,
      publishOverrideReason: 'P0 bootstrap',
      allowMismatchedCaseHash: true,
      json: true,
    })
  })
})
