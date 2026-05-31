import { describe, expect, it } from 'vitest'
import { formatQaReviewChecklist } from './qaReviewChecklistOutput'

describe('formatQaReviewChecklist', () => {
  it('formats reviewer instructions, rows, and follow-up commands', () => {
    const output = formatQaReviewChecklist({
      inputPath: 'next-review.csv',
      sourcePath: 'review.csv',
      outPath: 'next-review.md',
      mergedOutPath: 'review.merged.csv',
      configPath: 'xinyi.json',
      title: 'Xinyi gate rows',
      totalRows: 1,
      rowsWithReviewStatus: 0,
      provenance: {
        sourceDatasetHash: 'dataset-hash',
        sourceConfigHash: 'config-hash',
        sourceRowsTotal: '80',
      },
      rows: [
        {
          rowNumber: 2,
          sourceRowNumber: '8',
          districtId: 'xinyi',
          segmentId: 'seg-478',
          reviewBucket: 'marked_space_park',
          lat: '25.033',
          lon: '121.566',
          score: '96',
          tier: 'P0',
          allowedNow: 'PARK',
          parkingSpaceCount: '2',
          topReasons: '["PARKING_SPACE_EVIDENCE"]',
          flags: '["staleData"]',
          mapsUrl: 'https://maps.example.test',
          streetViewUrl: 'https://streetview.example.test',
          sourceDatasetHash: 'dataset-hash',
          sourceConfigHash: 'config-hash',
          sourceRowsTotal: '80',
          reviewPlanRank: '1',
          reviewPlanReason: 'bucket:marked_space_park',
          reviewStatus: null,
          reviewNote: null,
          createdAt: null,
        },
      ],
      errors: [],
      warnings: [],
      pass: true,
    })

    expect(output).toContain('# Xinyi gate rows')
    expect(output).toContain('Fill `reviewStatus` only after checking curb/sign/parking-space evidence')
    expect(output).toContain('source row 8 - marked_space_park - seg-478')
    expect(output).toContain('reasons ["PARKING_SPACE_EVIDENCE"]')
    expect(output).toContain('flags ["staleData"]')
    expect(output).toContain('[Street View](https://streetview.example.test)')
    expect(output).toContain('- Existing reviewNote: unknown')
    expect(output).toContain('- Existing createdAt: unknown')
    expect(output).toContain('npm run ops:apply-qa-review -- --source "review.csv"')
    expect(output).toContain('npm run ops:qa-review-gate -- --input "review.merged.csv"')
  })

  it('shows row-level evidence warnings for incomplete reviewed rows', () => {
    const output = formatQaReviewChecklist({
      inputPath: 'next-review.csv',
      sourcePath: null,
      outPath: null,
      mergedOutPath: null,
      configPath: null,
      title: 'Xinyi gate rows',
      totalRows: 1,
      rowsWithReviewStatus: 1,
      provenance: {
        sourceDatasetHash: null,
        sourceConfigHash: null,
        sourceRowsTotal: null,
      },
      rows: [
        {
          rowNumber: 2,
          sourceRowNumber: '8',
          districtId: 'xinyi',
          segmentId: 'seg-478',
          reviewBucket: 'marked_space_park',
          lat: '25.033',
          lon: '121.566',
          score: null,
          tier: null,
          allowedNow: null,
          parkingSpaceCount: null,
          mapsUrl: null,
          streetViewUrl: null,
          sourceDatasetHash: null,
          sourceConfigHash: null,
          sourceRowsTotal: null,
          reviewPlanRank: null,
          reviewPlanReason: null,
          reviewStatus: 'LEGAL',
          reviewNote: null,
          createdAt: null,
        },
      ],
      errors: [],
      warnings: [],
      pass: true,
    })

    expect(output).toContain(
      '- Row warning: reviewStatus is set but reviewNote/createdAt is incomplete.',
    )
  })
})
