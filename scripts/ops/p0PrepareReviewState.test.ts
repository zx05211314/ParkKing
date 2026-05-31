import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildP0PrepareReview } from './p0PrepareReviewState'

describe('buildP0PrepareReview', () => {
  it('writes a focused review packet without requiring reviewed statuses', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'p0-prepare-review-'))
    const sourcePath = path.join(base, 'xinyi-review.csv')
    const nextReviewOutPath = path.join(base, 'xinyi-next-review.csv')
    const checklistOutPath = path.join(base, 'xinyi-next-review.md')
    const geojsonOutPath = path.join(base, 'xinyi-next-review.geojson')
    const mergedOutPath = path.join(base, 'xinyi-review.merged.csv')

    await fs.writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,lat,lon,score,tier,allowedNow,parkingSpaceCount,mapsUrl,streetViewUrl,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-a,marked_space_park,25.01,121.51,9,GREEN,PARK,1,https://maps.example/a,https://street.example/a,,,',
        'xinyi,seg-b,no_stop,25.02,121.52,8,RED,NO_STOP,0,https://maps.example/b,https://street.example/b,,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildP0PrepareReview({
      sourcePath,
      configPath: 'configs/prod/xinyi.json',
      nextReviewOutPath,
      checklistOutPath,
      geojsonOutPath,
      mergedOutPath,
      nextReviewRowsLimit: 2,
    })

    expect(result.pass).toBe(true)
    expect(result.qaReview?.pass).toBe(false)
    expect(result.nextReviewRowsWritten).toBe(2)
    expect(await fs.readFile(nextReviewOutPath, 'utf-8')).toContain('sourceRowNumber')
    expect(await fs.readFile(checklistOutPath, 'utf-8')).toContain('Reviewer Rules')
    expect(await fs.readFile(geojsonOutPath, 'utf-8')).toContain('FeatureCollection')
  })

  it('passes without checklist or GeoJSON when the source review already satisfies P0', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'p0-prepare-review-ready-'))
    const sourcePath = path.join(base, 'xinyi-review.csv')
    const nextReviewOutPath = path.join(base, 'xinyi-next-review.csv')
    const checklistOutPath = path.join(base, 'xinyi-next-review.md')
    const geojsonOutPath = path.join(base, 'xinyi-next-review.geojson')
    const mergedOutPath = path.join(base, 'xinyi-review.merged.csv')

    await fs.writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,lat,lon,score,tier,allowedNow,parkingSpaceCount,mapsUrl,streetViewUrl,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-a,marked_space_park,25.01,121.51,9,GREEN,PARK,1,https://maps.example/a,https://street.example/a,LEGAL,field checked,2026-04-25T00:00:00.000Z',
        'xinyi,seg-b,marked_space_park,25.02,121.52,8,GREEN,PARK,1,https://maps.example/b,https://street.example/b,LEGAL,field checked,2026-04-25T00:00:00.000Z',
        'xinyi,seg-c,no_stop,25.03,121.53,7,RED,NO_STOP,0,https://maps.example/c,https://street.example/c,ILLEGAL,field checked,2026-04-25T00:00:00.000Z',
        'xinyi,seg-d,no_stop,25.04,121.54,6,RED,NO_STOP,0,https://maps.example/d,https://street.example/d,ILLEGAL,field checked,2026-04-25T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildP0PrepareReview({
      sourcePath,
      configPath: 'configs/prod/xinyi.json',
      nextReviewOutPath,
      checklistOutPath,
      geojsonOutPath,
      mergedOutPath,
      nextReviewRowsLimit: 2,
    })

    expect(result.pass).toBe(true)
    expect(result.qaReview?.pass).toBe(true)
    expect(result.nextReviewRowsWritten).toBe(0)
    expect(result.checklist).toBeNull()
    expect(result.geojson).toBeNull()
    expect(await fs.readFile(nextReviewOutPath, 'utf-8')).toContain('sourceRowNumber')
    await expect(fs.access(checklistOutPath)).rejects.toThrow()
    await expect(fs.access(geojsonOutPath)).rejects.toThrow()
  })
})
