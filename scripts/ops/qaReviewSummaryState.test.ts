import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildQaReviewSummary } from './qaReviewSummaryState'

const writeCsv = async (content: string) => {
  const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-summary-'))
  const inputPath = path.join(base, 'review.csv')
  await fs.writeFile(inputPath, content, 'utf-8')
  return inputPath
}

const writeAdjacentManifest = async (inputPath: string, payload: unknown) => {
  const manifestPath = inputPath.replace(/\.csv$/i, '.manifest.json')
  await fs.writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
  return manifestPath
}

describe('buildQaReviewSummary', () => {
  it('summarizes reviewed statuses and buckets', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewSource,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,stored_override,LEGAL,,2026-01-01T00:00:00Z',
        'xinyi,seg-2,no_stop,manual,ILLEGAL,,2026-01-01T00:00:00Z',
        'xinyi,seg-3,inferred,,,,',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({
      inputPath,
      minReviewed: 2,
      requireStatuses: ['LEGAL', 'ILLEGAL'],
      requireBuckets: ['marked_space_park'],
      minReviewedBuckets: { marked_space_park: 1, no_stop: 1 },
    })

    expect(summary.pass).toBe(true)
    expect(summary.totalRows).toBe(3)
    expect(summary.reviewedRows).toBe(2)
    expect(summary.validReviewedRows).toBe(2)
    expect(summary.pendingRows).toBe(1)
    expect(summary.statusCounts).toMatchObject({ LEGAL: 1, ILLEGAL: 1 })
    expect(summary.reviewSourceCounts).toMatchObject({
      stored_override: 1,
      manual: 1,
      pending: 1,
    })
    expect(summary.reviewedBucketCounts).toMatchObject({
      marked_space_park: 1,
      no_stop: 1,
    })
    expect(summary.nextReviewRows).toHaveLength(0)
  })

  it('fails when a reviewed bucket is below its required minimum', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,LEGAL',
        'xinyi,seg-2,no_stop,ILLEGAL',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({
      inputPath,
      minReviewed: 0,
      minReviewedBuckets: { marked_space_park: 2, no_stop: 1 },
    })

    expect(summary.pass).toBe(false)
    expect(summary.errors).toContain(
      'Reviewed rows for bucket marked_space_park 1 is below required minimum 2.',
    )
    expect(summary.errors).not.toContain(
      'Reviewed rows for bucket no_stop 1 is below required minimum 1.',
    )
  })

  it('returns prioritized pending rows for the next review batch', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,lat,lon,score,reviewBucket,tier,allowedNow,curbMarking,sourceType,sourceReliability,dataFreshnessDays,finalConfidence,parkingSpaceCount,topReasons[],flags,riskTags,streetViewUrl,reviewStatus',
        'xinyi,seg-1,25.0,121.5,5,marked_space_park,GREEN,PARK,YELLOW,CURB,HIGH,12,HIGH,2,"[""PARKING_SPACE_EVIDENCE""]","[""staleData""]","[""HARD_ZONE_NEAR""]",https://street-view-1.test,',
        'xinyi,seg-2,25.1,121.6,4,no_stop,RED,NO_STOP,RED,CURB,HIGH,12,HIGH,0,,,,https://street-view-2.test,',
        'xinyi,seg-3,25.2,121.7,3,inferred,YELLOW,PARK,YELLOW,INFERRED,LOW,,LOW,0,,,,https://street-view-3.test,',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({
      inputPath,
      minReviewed: 2,
      requireStatuses: ['LEGAL', 'ILLEGAL'],
      requireBuckets: ['marked_space_park'],
      minReviewedBuckets: { no_stop: 1 },
      nextReviewRowsLimit: 2,
    })

    expect(summary.reviewRequirements).toEqual({
      minReviewedRemaining: 2,
      estimatedMinimumNewReviews: 2,
      missingStatuses: ['LEGAL', 'ILLEGAL'],
      missingBuckets: ['marked_space_park'],
      bucketMinimumsRemaining: { no_stop: 1 },
    })
    expect(summary.nextReviewRows).toMatchObject([
      {
        rowNumber: 2,
        segmentId: 'seg-1',
        reviewBucket: 'marked_space_park',
        curbMarking: 'YELLOW',
        sourceType: 'CURB',
        sourceReliability: 'HIGH',
        dataFreshnessDays: '12',
        finalConfidence: 'HIGH',
        topReasons: '["PARKING_SPACE_EVIDENCE"]',
        flags: '["staleData"]',
        riskTags: '["HARD_ZONE_NEAR"]',
        streetViewUrl: 'https://street-view-1.test',
      },
      {
        rowNumber: 3,
        segmentId: 'seg-2',
        reviewBucket: 'no_stop',
        streetViewUrl: 'https://street-view-2.test',
      },
    ])
  })

  it('auto-loads the adjacent review manifest for traceability', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-01-01T00:00:00Z',
      ].join('\n'),
    )
    const manifestPath = await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {
        baseDir: 'public/data/generated/xinyi',
        datasetHash: 'dataset-hash',
        configHash: 'config-hash',
        generatedAt: '2026-04-20T00:00:00.000Z',
        publishedAt: '2026-04-21T00:00:00.000Z',
      },
      params: {
        strategy: 'review',
        hhmm: '21:00',
        topN: 80,
      },
      rows: {
        total: 1,
      },
    })

    const summary = await buildQaReviewSummary({ inputPath })

    expect(summary.manifest).toMatchObject({
      path: manifestPath,
      districtId: 'xinyi',
      datasetHash: 'dataset-hash',
      configHash: 'config-hash',
      strategy: 'review',
      hhmm: '21:00',
      topN: 80,
      rowsTotal: 1,
    })
    expect(summary.warnings).toHaveLength(0)
  })

  it('warns when the review manifest points at another CSV', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,LEGAL',
      ].join('\n'),
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: path.join(path.dirname(inputPath), 'other.csv'),
      dataset: {},
      params: {},
      rows: {},
    })

    const summary = await buildQaReviewSummary({ inputPath })

    expect(summary.warnings).toContain(
      `Review manifest csvPath ${path.join(path.dirname(inputPath), 'other.csv')} does not match input ${inputPath}.`,
    )
  })

  it('fails strict manifest mode when the manifest points at another CSV', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,LEGAL',
      ].join('\n'),
    )
    const otherCsvPath = path.join(path.dirname(inputPath), 'other.csv')
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: otherCsvPath,
      dataset: {},
      params: {},
      rows: { total: 1 },
    })

    const summary = await buildQaReviewSummary({ inputPath, strictManifest: true })

    expect(summary.pass).toBe(false)
    expect(summary.errors).toContain(
      `Review manifest csvPath ${otherCsvPath} does not match input ${inputPath}.`,
    )
  })

  it('fails strict manifest mode when manifest row total does not match CSV rows', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,LEGAL',
      ].join('\n'),
    )
    await writeAdjacentManifest(inputPath, {
      schemaVersion: 1,
      districtId: 'xinyi',
      csvPath: inputPath,
      dataset: {},
      params: {},
      rows: { total: 2 },
    })

    const summary = await buildQaReviewSummary({ inputPath, strictManifest: true })

    expect(summary.pass).toBe(false)
    expect(summary.errors).toContain(
      'Review manifest row total 2 does not match CSV row total 1.',
    )
  })

  it('fails when the review packet has no valid reviewed rows', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({ inputPath })

    expect(summary.pass).toBe(false)
    expect(summary.errors).toContain(
      'Valid reviewed rows 0 is below required minimum 1.',
    )
  })

  it('does not treat signOverrideStatus evidence as a reviewed verdict when reviewStatus is blank', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,signOverrideStatus,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,,,',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({ inputPath })

    expect(summary.reviewedRows).toBe(0)
    expect(summary.validReviewedRows).toBe(0)
    expect(summary.pendingRows).toBe(1)
    expect(summary.nextReviewRows[0]?.signOverrideStatus).toBe('LEGAL')
    expect(summary.errors).toContain(
      'Valid reviewed rows 0 is below required minimum 1.',
    )
  })

  it('warns about invalid statuses and reviewed rows missing identity/evidence', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,,marked_space_park,LEGAL',
        'xinyi,seg-2,no_stop,MAYBE',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({ inputPath, minReviewed: 0 })

    expect(summary.pass).toBe(true)
    expect(summary.invalidStatusRows).toBe(1)
    expect(summary.missingIdentityRows).toBe(1)
    expect(summary.missingEvidenceRows).toBe(2)
    expect(summary.warnings).toContain(
      '2 reviewed row(s) are missing reviewNote or createdAt.',
    )
  })

  it('warns or fails for reviewed rows with invalid timestamps', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,not-a-date',
      ].join('\n'),
    )

    const loose = await buildQaReviewSummary({ inputPath, minReviewed: 0 })
    expect(loose.pass).toBe(true)
    expect(loose.invalidTimestampRows).toBe(1)
    expect(loose.warnings).toContain(
      '1 reviewed row(s) have invalid createdAt timestamps; createdAt must be an ISO timestamp with timezone, for example 2026-05-22T12:00:00.000Z.',
    )

    const strict = await buildQaReviewSummary({
      inputPath,
      minReviewed: 0,
      strictReviewedRows: true,
    })
    expect(strict.pass).toBe(false)
    expect(strict.errors).toContain(
      '1 reviewed row(s) have invalid createdAt timestamps; createdAt must be an ISO timestamp with timezone, for example 2026-05-22T12:00:00.000Z.',
    )
  })

  it('warns when one segment has multiple reviewed rows', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,LEGAL',
        'xinyi,seg-1,no_stop,ILLEGAL',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({ inputPath, minReviewed: 0 })

    expect(summary.pass).toBe(true)
    expect(summary.duplicateReviewedSegments).toBe(1)
    expect(summary.duplicateReviewedRows).toBe(1)
    expect(summary.conflictingReviewedSegments).toBe(1)
    expect(summary.warnings).toContain(
      '1 segment(s) have multiple reviewed rows; export would collapse 1 reviewed row(s) to the latest verdict.',
    )
    expect(summary.warnings).toContain(
      '1 segment(s) have conflicting reviewed statuses for the same districtId+segmentId.',
    )
  })

  it('fails strict segment mode when reviewed segment rows conflict', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,seg-1,marked_space_park,LEGAL',
        'xinyi,seg-1,no_stop,ILLEGAL',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({
      inputPath,
      minReviewed: 0,
      strictReviewedSegments: true,
    })

    expect(summary.pass).toBe(false)
    expect(summary.errors).toContain(
      '1 segment(s) have multiple reviewed rows; export would collapse 1 reviewed row(s) to the latest verdict.',
    )
    expect(summary.errors).toContain(
      '1 segment(s) have conflicting reviewed statuses for the same districtId+segmentId.',
    )
  })

  it('fails strict reviewed-row mode for invalid statuses and missing identity', async () => {
    const inputPath = await writeCsv(
      [
        'districtId,segmentId,reviewBucket,reviewStatus',
        'xinyi,,marked_space_park,LEGAL',
        'xinyi,seg-2,no_stop,MAYBE',
      ].join('\n'),
    )

    const summary = await buildQaReviewSummary({
      inputPath,
      minReviewed: 0,
      strictReviewedRows: true,
    })

    expect(summary.pass).toBe(false)
    expect(summary.errors).toContain(
      '1 reviewed row(s) use a status outside LEGAL, ILLEGAL, UNCLEAR.',
    )
    expect(summary.errors).toContain(
      '1 reviewed row(s) are missing districtId or segmentId.',
    )
  })
})
