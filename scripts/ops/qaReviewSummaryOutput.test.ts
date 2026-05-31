import { describe, expect, it } from 'vitest'
import {
  formatQaNextReviewRowsCsv,
  formatQaReviewSummary,
} from './qaReviewSummaryOutput'

describe('formatQaReviewSummary', () => {
  const buildSummary = () => ({
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
        rowsTotal: 2,
      },
      totalRows: 2,
      reviewedRows: 1,
      validReviewedRows: 0,
      pendingRows: 1,
      invalidStatusRows: 1,
      missingIdentityRows: 0,
      duplicateReviewedSegments: 0,
      duplicateReviewedRows: 0,
      conflictingReviewedSegments: 0,
      statusCounts: { MAYBE: 1 },
      reviewSourceCounts: { manual: 1, pending: 1 },
      bucketCounts: { no_stop: 2 },
      reviewedBucketCounts: { no_stop: 1 },
      districtCounts: { xinyi: 2 },
      reviewRequirements: {
        minReviewedRemaining: 1,
        estimatedMinimumNewReviews: 2,
        missingStatuses: ['LEGAL'],
        missingBuckets: ['marked_space_park'],
        bucketMinimumsRemaining: { marked_space_park: 2 },
      },
      nextReviewRows: [
        {
          rowNumber: 3,
          districtId: 'xinyi',
          segmentId: 'seg-2',
          reviewBucket: 'marked_space_park',
          lat: '25.0',
          lon: '121.5',
          score: '1',
          tier: 'GREEN',
          allowedNow: 'PARK',
          curbMarking: 'YELLOW',
          sourceType: 'CURB',
          sourceReliability: 'HIGH',
          dataFreshnessDays: '12',
          finalConfidence: 'HIGH',
          coverageConfidence: 'HIGH',
          overrideConfidence: 'LOW',
          parkingSpaceCount: '2',
          topReasons: '["PARKING_SPACE_EVIDENCE"]',
          flags: '["staleData"]',
          riskTags: '["HARD_ZONE_NEAR"]',
          signOverrideStatus: '',
          signOverrideSource: '',
          signOverrideVerifiedAt: '',
          signOverrideNote: '',
          mapsUrl: 'https://example.test/map',
          streetViewUrl: 'https://example.test/street-view',
        },
      ],
      errors: ['Valid reviewed rows 0 is below required minimum 1.'],
      warnings: ['1 reviewed row(s) use a status outside LEGAL, ILLEGAL, UNCLEAR.'],
      pass: false,
    })

  it('formats pass/fail, counts, diagnostics, and next rows', () => {
    const output = formatQaReviewSummary(buildSummary())

    expect(output).toContain('Status: FAIL')
    expect(output).toContain('Manifest: review.manifest.json')
    expect(output).toContain('Dataset hash: dataset-hash')
    expect(output).toContain('Review integrity: invalid statuses 1')
    expect(output).toContain('Review requirements:')
    expect(output).toContain('- Estimated minimum new reviews: 2')
    expect(output).toContain('- Missing statuses: LEGAL')
    expect(output).toContain('Review plan:')
    expect(output).toContain(
      '- Status coverage still needs: LEGAL; fill reviewStatus only after checking sign/curb evidence.',
    )
    expect(output).toContain('row 3: marked_space_park seg-2')
    expect(output).toContain('Statuses: MAYBE 1')
    expect(output).toContain('Review sources: manual 1, pending 1')
    expect(output).toContain('Errors:')
    expect(output).toContain('Warnings:')
  })

  it('formats next review rows as a handoff CSV', () => {
    const output = formatQaNextReviewRowsCsv(buildSummary())

    expect(output).toContain(
      'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,score,tier,allowedNow,curbMarking,sourceType,sourceReliability,dataFreshnessDays,finalConfidence,coverageConfidence,overrideConfidence,parkingSpaceCount,topReasons,flags,riskTags,signOverrideStatus,signOverrideSource,signOverrideVerifiedAt,signOverrideNote,mapsUrl,streetViewUrl,sourceDatasetHash,sourceConfigHash,sourceRowsTotal,reviewPlanRank,reviewPlanReason,reviewStatus,reviewNote,createdAt',
    )
    expect(output).toContain(
      '3,xinyi,seg-2,marked_space_park,25.0,121.5,1,GREEN,PARK,YELLOW,CURB,HIGH,12,HIGH,HIGH,LOW,2,"[""PARKING_SPACE_EVIDENCE""]","[""staleData""]","[""HARD_ZONE_NEAR""]",,,,,https://example.test/map,https://example.test/street-view,dataset-hash,config-hash,2,1,bucket:marked_space_park,,,',
    )
  })
})
