import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { formatQaNextReviewRowsCsv } from './qaReviewSummaryOutput'
import { buildQaReviewSummary } from './qaReviewSummaryState'
import { applyQaReviewHandoff } from './qaReviewApplyState'

const writeFile = async (targetPath: string, content: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, content, 'utf-8')
}

const writeAdjacentManifest = async (
  sourcePath: string,
  payload: Record<string, unknown>,
) => {
  const manifestPath = sourcePath.replace(/\.csv$/i, '.manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(payload, null, 2)}\n`)
  return manifestPath
}

const buildFixture = async () => {
  const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-apply-'))
  return {
    sourcePath: path.join(base, 'review.csv'),
    reviewsPath: path.join(base, 'next-review.csv'),
    outPath: path.join(base, 'merged.csv'),
  }
}

describe('applyQaReviewHandoff', () => {
  it('applies reviewed handoff rows back to the source QA CSV', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
        'xinyi,seg-2,no_stop,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z',
        '3,xinyi,seg-2,no_stop,,,',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(true)
    expect(result.appliedRows).toBe(1)
    expect(result.skippedBlankRows).toBe(1)
    const merged = await fs.readFile(outPath, 'utf-8')
    expect(merged).toContain('createdAt,reviewSource')
    expect(merged).toContain(
      'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z,manual',
    )
    expect(merged).toContain('xinyi,seg-2,no_stop,,,,')
  })

  it('applies a filled priority-review CSV back to the source QA CSV', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'daan,seg-1,marked_space_park,,,',
        'daan,seg-2,no_stop,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'districtId,status,minimumNewReviews,rank,handoffRowNumber,sourceRowNumber,segmentId,reviewBucket,reasons,mapsUrl,streetViewUrl,handoffCsv,reviewStatus,reviewNote,createdAt',
        'daan,ready-for-review,2,1,2,2,seg-1,marked_space_park,bucket:marked_space_park,https://maps.test,https://street.test,.tmp/daan-next-review.csv,LEGAL,street checked legal,2026-05-16T00:00:00.000Z',
        'daan,ready-for-review,2,2,3,3,seg-2,no_stop,bucket:no_stop,https://maps.test,https://street.test,.tmp/daan-next-review.csv,ILLEGAL,street checked illegal,2026-05-16T00:05:00.000Z',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(true)
    expect(result.appliedRows).toBe(2)
    const merged = await fs.readFile(outPath, 'utf-8')
    expect(merged).toContain(
      'daan,seg-1,marked_space_park,LEGAL,street checked legal,2026-05-16T00:00:00.000Z,manual',
    )
    expect(merged).toContain(
      'daan,seg-2,no_stop,ILLEGAL,street checked illegal,2026-05-16T00:05:00.000Z,manual',
    )
  })

  it('fails when handoff identity does not match the source row', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus',
        '2,xinyi,seg-2,marked_space_park,LEGAL',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(false)
    expect(result.appliedRows).toBe(0)
    expect(result.errors[0]).toContain(
      'identity xinyi/seg-2 does not match source row 2 xinyi/seg-1',
    )
    await expect(fs.access(outPath)).rejects.toThrow()
  })

  it('fails when a reviewed handoff row has an invalid status', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus',
        '2,xinyi,seg-1,marked_space_park,MAYBE',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Review handoff row 2: invalid reviewStatus "MAYBE" (expected LEGAL, ILLEGAL, or UNCLEAR).',
    )
    await expect(fs.access(outPath)).rejects.toThrow()
  })

  it('does not overwrite existing source verdicts unless allowed', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,LEGAL,old,2026-04-24T00:00:00.000Z',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,ILLEGAL,new,2026-04-25T00:00:00.000Z',
      ].join('\n'),
    )

    const blocked = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })
    expect(blocked.pass).toBe(false)
    expect(blocked.errors[0]).toContain('already has reviewStatus LEGAL')

    const allowed = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
      allowOverwrite: true,
    })
    expect(allowed.pass).toBe(true)
    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      'xinyi,seg-1,marked_space_park,ILLEGAL,new,2026-04-25T00:00:00.000Z',
    )
  })

  it('fails when a reviewed handoff row is missing evidence note or timestamp', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,LEGAL,,',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Review handoff row 2: reviewNote and createdAt are required when reviewStatus is set.',
    )
    await expect(fs.access(outPath)).rejects.toThrow()
  })

  it('fails when a reviewed handoff row has an invalid timestamp', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,LEGAL,field checked,not-a-date',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Review handoff row 2: createdAt must be an ISO timestamp with timezone, for example 2026-05-22T12:00:00.000Z.',
    )
    await expect(fs.access(outPath)).rejects.toThrow()
  })

  it('fails when no handoff rows have a review status', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus',
        '2,xinyi,seg-1,marked_space_park,',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'No reviewed rows found in review handoff CSV. Fill reviewStatus before applying.',
    )
    await expect(fs.access(outPath)).rejects.toThrow()
  })

  it('verifies handoff provenance against the source review manifest', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeAdjacentManifest(sourcePath, {
      csvPath: sourcePath,
      dataset: {
        datasetHash: 'dataset-hash',
        configHash: 'config-hash',
      },
      rows: {
        total: 1,
      },
    })
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,sourceDatasetHash,sourceConfigHash,sourceRowsTotal,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,dataset-hash,config-hash,1,LEGAL,field checked,2026-04-25T00:00:00.000Z',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(true)
    expect(result.appliedRows).toBe(1)
    expect(result.manifestPath).toBe(outPath.replace(/\.csv$/i, '.manifest.json'))
    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      'xinyi,seg-1,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z,manual',
    )
    const mergedManifest = JSON.parse(
      await fs.readFile(result.manifestPath ?? '', 'utf-8'),
    ) as {
      csvPath?: string
      rows?: {
        total?: number
        reviewStatusCounts?: Record<string, number>
        reviewSourceCounts?: Record<string, number>
      }
      appliedReview?: { appliedRows?: number; skippedBlankRows?: number }
    }
    expect(mergedManifest.csvPath).toBe(outPath)
    expect(mergedManifest.rows?.total).toBe(1)
    expect(mergedManifest.rows?.reviewStatusCounts).toEqual({ LEGAL: 1 })
    expect(mergedManifest.rows?.reviewSourceCounts).toEqual({ manual: 1 })
    expect(mergedManifest.appliedReview).toMatchObject({
      appliedRows: 1,
      skippedBlankRows: 0,
    })
  })

  it('fails when handoff provenance does not match the source review manifest', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
    )
    await writeAdjacentManifest(sourcePath, {
      csvPath: sourcePath,
      dataset: {
        datasetHash: 'dataset-hash',
        configHash: 'config-hash',
      },
      rows: {
        total: 1,
      },
    })
    await writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,sourceDatasetHash,sourceConfigHash,sourceRowsTotal,reviewStatus',
        '2,xinyi,seg-1,marked_space_park,stale-dataset-hash,config-hash,1,LEGAL',
      ].join('\n'),
    )

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(false)
    expect(result.appliedRows).toBe(0)
    expect(result.errors).toContain(
      'Review handoff row 2: sourceDatasetHash "stale-dataset-hash" does not match source manifest "dataset-hash".',
    )
    await expect(fs.access(outPath)).rejects.toThrow()
  })

  it('applies a handoff CSV generated by the QA review summary formatter', async () => {
    const { sourcePath, reviewsPath, outPath } = await buildFixture()
    await writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,lat,lon,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,25.0,121.5,,,',
      ].join('\n'),
    )
    await writeAdjacentManifest(sourcePath, {
      csvPath: sourcePath,
      dataset: {
        datasetHash: 'dataset-hash',
        configHash: 'config-hash',
      },
      rows: {
        total: 1,
      },
    })

    const summary = await buildQaReviewSummary({
      inputPath: sourcePath,
      nextReviewRowsLimit: 1,
      minReviewed: 1,
    })
    const handoff = formatQaNextReviewRowsCsv(summary).replace(
      'dataset-hash,config-hash,1,1,additional_valid_review,,,',
      'dataset-hash,config-hash,1,1,additional_valid_review,LEGAL,street checked,2026-04-25T00:00:00.000Z',
    )
    await writeFile(reviewsPath, handoff)

    const result = await applyQaReviewHandoff({
      sourcePath,
      reviewsPath,
      outPath,
    })

    expect(result.pass).toBe(true)
    expect(result.appliedRows).toBe(1)
    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain(
      'xinyi,seg-1,marked_space_park,25.0,121.5,LEGAL,street checked,2026-04-25T00:00:00.000Z',
    )
  })
})
