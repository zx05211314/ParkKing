import { describe, expect, it } from 'vitest'
import { formatQaReviewGate } from './qaReviewGateOutput'

describe('formatQaReviewGate', () => {
  it('formats gate status, exports, and diagnostics', () => {
    const output = formatQaReviewGate({
      inputPath: 'review.csv',
      inputKind: 'csv',
      configPath: 'xinyi.json',
      outDir: 'out',
      summary: {
        inputPath: 'review.csv',
        manifest: {
          path: 'review.manifest.json',
          districtId: 'xinyi',
          csvPath: 'review.csv',
          datasetBaseDir: 'public/data/generated/xinyi',
          datasetHash: 'dataset-hash',
          configHash: 'config-hash',
          generatedAt: null,
          publishedAt: null,
          strategy: 'review',
          hhmm: '21:00',
          topN: 80,
          rowsTotal: 1,
        },
        totalRows: 1,
        reviewedRows: 1,
        validReviewedRows: 1,
        pendingRows: 0,
        invalidStatusRows: 0,
        missingIdentityRows: 0,
        duplicateReviewedSegments: 0,
        duplicateReviewedRows: 0,
        conflictingReviewedSegments: 0,
        statusCounts: { LEGAL: 1 },
        reviewSourceCounts: { manual: 1 },
        bucketCounts: { marked_space_park: 1 },
        reviewedBucketCounts: { marked_space_park: 1 },
        districtCounts: { xinyi: 1 },
        reviewRequirements: {
          minReviewedRemaining: 0,
          estimatedMinimumNewReviews: 0,
          missingStatuses: [],
          missingBuckets: [],
          bucketMinimumsRemaining: {},
        },
        nextReviewRows: [
          {
            rowNumber: 2,
            districtId: 'xinyi',
            segmentId: 'seg-2',
            reviewBucket: 'marked_space_park',
            lat: '25.033',
            lon: '121.566',
            score: '5',
            tier: 'GREEN',
            allowedNow: 'PARK',
            parkingSpaceCount: '2',
            topReasons: '["PARKING_SPACE_EVIDENCE"]',
            flags: '["staleData"]',
            mapsUrl: null,
            streetViewUrl: 'https://streetview.example.test',
          },
        ],
        errors: [],
        warnings: [],
        pass: true,
      },
      exports: [{ districtId: 'xinyi', count: 1, outputPath: 'out/xinyi.jsonl' }],
      preflight: null,
      errors: ['missing segment'],
      warnings: ['duplicate collapsed'],
      pass: false,
    })

    expect(output).toContain('# QA Review Gate: FAIL')
    expect(output).toContain('- Input kind: csv')
    expect(output).toContain('- Review segment integrity: 0 duplicate / 0 conflicting')
    expect(output).toContain('xinyi: 1 -> out/xinyi.jsonl')
    expect(output).toContain('## Review Requirements')
    expect(output).toContain('- Estimated minimum new reviews: 0')
    expect(output).toContain('- Remaining valid reviews: 0')
    expect(output).toContain('## Review Plan')
    expect(output).toContain(
      '- No additional review rows required by configured thresholds.',
    )
    expect(output).toContain('## Next Review Rows')
    expect(output).toContain('reasons ["PARKING_SPACE_EVIDENCE"]')
    expect(output).toContain('flags ["staleData"]')
    expect(output).toContain('## Next Step')
    expect(output).toContain('- Gate failed; fix errors before ingesting overrides.')
    expect(output).toContain('- missing segment')
    expect(output).toContain('- duplicate collapsed')
  })

  it('shows default-ingest handoff when the gate passes', () => {
    const output = formatQaReviewGate({
      inputPath: 'review.csv',
      inputKind: 'csv',
      configPath: 'xinyi.json',
      outDir: 'data/overrides',
      summary: {
        inputPath: 'review.csv',
        manifest: {
          path: 'review.manifest.json',
          districtId: 'xinyi',
          csvPath: 'review.csv',
          datasetBaseDir: 'public/data/generated/xinyi',
          datasetHash: 'dataset-hash',
          configHash: 'config-hash',
          generatedAt: null,
          publishedAt: null,
          strategy: 'review',
          hhmm: '21:00',
          topN: 80,
          rowsTotal: 1,
        },
        totalRows: 1,
        reviewedRows: 1,
        validReviewedRows: 1,
        pendingRows: 0,
        invalidStatusRows: 0,
        missingIdentityRows: 0,
        duplicateReviewedSegments: 0,
        duplicateReviewedRows: 0,
        conflictingReviewedSegments: 0,
        statusCounts: { LEGAL: 1 },
        reviewSourceCounts: { manual: 1 },
        bucketCounts: { marked_space_park: 1 },
        reviewedBucketCounts: { marked_space_park: 1 },
        districtCounts: { xinyi: 1 },
        reviewRequirements: {
          minReviewedRemaining: 0,
          estimatedMinimumNewReviews: 0,
          missingStatuses: [],
          missingBuckets: [],
          bucketMinimumsRemaining: {},
        },
        nextReviewRows: [],
        errors: [],
        warnings: [],
        pass: true,
      },
      exports: [{ districtId: 'xinyi', count: 1, outputPath: 'data/overrides/xinyi.jsonl' }],
      preflight: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        configPath: 'xinyi.json',
        inputPath: 'data/overrides/xinyi.jsonl',
        inputExists: true,
        inputWarning: null,
        knownSegments: 1,
        rawReports: 1,
        validReports: 1,
        skippedInvalidReports: 0,
        skippedForeignDistrictReports: 0,
        effectiveOverrides: 1,
        duplicateSegmentsCollapsed: 0,
        matchedSegmentOverrides: 1,
        missingSegmentOverrides: 0,
        statusCounts: { LEGAL: 1, ILLEGAL: 0, UNCLEAR: 0 },
        missingSegmentIds: [],
        duplicateSegmentIds: [],
        missingIssues: [],
      },
      errors: [],
      warnings: [],
      pass: true,
    })

    expect(output).toContain('- Ingest-ready override path: data/overrides/xinyi.jsonl')
    expect(output).toContain('- Review manifest: review.manifest.json')
    expect(output).toContain('- Dataset hash: dataset-hash')
    expect(output).toContain(
      '- Rebuild district pack: npm run ingest:all -- --configs "xinyi.json"',
    )
    expect(output).toContain(
      '- Verify default override input: npm run ops:preflight-sign-overrides -- --config "xinyi.json"',
    )
  })
})
