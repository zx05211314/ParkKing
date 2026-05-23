import { describe, expect, it } from 'vitest'
import { formatP0Readiness } from './p0ReadinessOutput'
import type { P0ReadinessResult } from './p0ReadinessTypes'

const buildResult = (): P0ReadinessResult => ({
  pass: false,
  inputs: {
    districtId: 'xinyi',
    datasetDir: 'public/data/generated/xinyi',
    reviewPath: '.tmp/xinyi-review.csv',
    manifestPath: null,
    configPath: 'configs/prod/xinyi.json',
    publishReportPath: 'public/data/generated/ingest_all_report.json',
    answerCasesPath: 'configs/prod/xinyi.answer-cases.json',
    hhmm: '21:00',
    searchRadiusMeters: 25,
    nextReviewRowsLimit: 4,
    allowPublishWarn: false,
    allowPublishFail: false,
    publishOverrideReason: null,
  },
  exactSmoke: {
    pass: true,
    error: null,
    summary: {
      datasetDir: 'public/data/generated/xinyi',
      datasetHash: 'dataset-hash',
      hhmm: '21:00',
      searchRadiusMeters: 25,
      evaluatedCount: 10,
      samples: [],
      casesPath: 'configs/prod/xinyi.answer-cases.json',
      caseResults: [
        {
          id: 'case-1',
          label: 'case one',
          hhmm: '21:00',
          location: [121.56, 25.03],
          searchRadiusMeters: 25,
          expectedKind: 'PARK',
          answerKind: 'PARK',
          expectedEvidenceKind: 'MARKED_SPACE',
          evidenceKind: 'MARKED_SPACE',
          expectedPrimarySegmentId: 'seg-1',
          primarySegmentId: 'seg-1',
          distanceMeters: 1,
          parkingSpaceCount: 2,
          pass: true,
          errors: [],
        },
      ],
      counts: {
        parkAnswers: 1,
        noStopAnswers: 1,
        markedSpaceParkAnswers: 1,
      },
    },
  },
  qaReview: {
    pass: false,
    error: null,
    summary: {
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
      nextReviewRows: [
        {
          rowNumber: 2,
          districtId: 'xinyi',
          segmentId: 'seg-478',
          reviewBucket: 'marked_space_park',
          lat: '25.033',
          lon: '121.566',
          score: '5',
          tier: 'GREEN',
          allowedNow: 'PARK',
          parkingSpaceCount: '2',
          topReasons: '["PARKING_SPACE_EVIDENCE"]',
          flags: '["staleData"]',
          mapsUrl: 'https://maps.example.test',
          streetViewUrl: 'https://streetview.example.test',
        },
      ],
      errors: ['Valid reviewed rows 0 is below required minimum 1.'],
      warnings: [],
      pass: false,
    },
  },
  publishGate: {
    pass: false,
    error: null,
    summary: {
      generatedAt: '2026-04-25T00:00:00.000Z',
      reportPath: 'public/data/generated/ingest_all_report.json',
      mode: 'strict',
      allowWarn: false,
      allowFail: false,
      allowFailRequested: false,
      allowBaselineAdopt: false,
      overrideReason: null,
      bootstrap: {
        requested: false,
        modeUsed: false,
        denied: false,
        previousPackExists: false,
      },
      baselineAdopt: {
        enabled: false,
        applied: false,
        districtIds: [],
        reason: null,
      },
      gateMessageFlags: [],
      totals: {
        info: 0,
        warn: 0,
        fail: 28,
      },
      districts: [
        {
          districtId: 'xinyi',
          info: 0,
          warn: 0,
          fail: 28,
          topWarnCodes: [],
          topFailCodes: ['REASON_CODE_NEW', 'COUNT_DELTA'],
          signOverrideBreakdown: {
            total: 0,
            matchedBySegmentId: null,
            matchedBySpatial: null,
            unmatchedNamed: null,
          },
        },
      ],
      exitCode: 3,
    },
  },
})

describe('formatP0Readiness', () => {
  it('formats the current blockers and next review rows', () => {
    const output = formatP0Readiness(buildResult())

    expect(output).toContain('# P0 Readiness: BLOCKED')
    expect(output).toContain('Counts: PARK 1, NO_STOP 1, MARKED_SPACE_PARK 1')
    expect(output).toContain('- Answer cases: 1/1 passed')
    expect(output).toContain('- Answer cases: configs/prod/xinyi.answer-cases.json')
    expect(output).toContain('Valid reviewed rows 0 is below required minimum 1.')
    expect(output).toContain('- Review sources: pending 80')
    expect(output).toContain('## Review Pack Provenance')
    expect(output).toContain('## Current Config Drift')
    expect(output).toContain('- Allow publish WARN override: no')
    expect(output).toContain('- Allow publish FAIL override: no')
    expect(output).toContain('Publish gate is blocking with exit code 3')
    expect(output).toContain('source row 2, marked_space_park, seg-478')
    expect(output).toContain('topReasons ["PARKING_SPACE_EVIDENCE"]')
    expect(output).toContain('flags ["staleData"]')
    expect(output).toContain('npm run ops:p0-prepare-review -- --district xinyi')
    expect(output).toContain('npm run ops:qa-review-geojson --')
    expect(output).toContain('npm run ops:p0-finalize-review -- --district xinyi')
    expect(output).toContain('npm run ops:p0-promote-review -- --district xinyi')
    expect(output).toContain(
      'npm run ops:refresh-publish-report -- --config "configs/prod/xinyi.json"',
    )
    expect(output).toContain(
      'npm run ops:p0-readiness -- --review ".tmp\\xinyi-review.merged.csv" --config "configs/prod/xinyi.json"',
    )
    expect(output).toContain(
      '# Production release smoke after readiness passes; requires Chrome and Node 22+.',
    )
    expect(output).toContain('npm run ops:smoke-ui-parking-answers:preview --')
    expect(output).toContain('npm run ops:smoke-ui-parking-answers-map:preview --')
    expect(output).toContain('npm run ops:p1-release-readiness')
    expect(output).toContain('--cases "configs/prod/xinyi.answer-cases.json"')
    expect(output).toContain('npm run ops:qa-review-gate --')
  })

  it('keeps the resolved merged review path in the follow-up readiness command', () => {
    const result = buildResult()
    result.inputs.reviewPath = '.tmp/xinyi-current-review.merged.csv'

    const output = formatP0Readiness(result)

    expect(output).toContain(
      'npm run ops:p0-readiness -- --review ".tmp/xinyi-current-review.merged.csv" --config "configs/prod/xinyi.json"',
    )
  })
})
