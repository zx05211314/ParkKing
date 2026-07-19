import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildP0PromoteReview } from './p0PromoteReviewState'

describe('buildP0PromoteReview', () => {
  it('gates the source review CSV when the handoff has no reviewed rows', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-promote-review-'))
    const sourcePath = path.join(base, 'xinyi-review.csv')
    const reviewsPath = path.join(base, 'xinyi-next-review.csv')
    const mergedOutPath = path.join(base, 'xinyi-review.merged.csv')
    const configPath = path.join(base, 'xinyi.json')
    await fs.writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )
    await fs.writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildP0PromoteReview({
      sourcePath,
      reviewsPath,
      mergedOutPath,
      configPath,
    })

    expect(result.pass).toBe(false)
    expect(result.apply).toBeNull()
    expect(result.gate?.pass).toBe(false)
    expect(result.errors).toContain(
      'Valid reviewed rows 0 is below required minimum 1.',
    )
    await expect(fs.access(mergedOutPath)).rejects.toThrow()
  })

  it('promotes a source review CSV that already satisfies the P0 gate', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-promote-review-ready-'))
    const sourcePath = path.join(base, 'xinyi-review.csv')
    const reviewsPath = path.join(base, 'xinyi-next-review.csv')
    const mergedOutPath = path.join(base, 'xinyi-review.merged.csv')
    const outDir = path.join(base, 'overrides')
    const configPath = path.join(base, 'xinyi.json')
    const generatedDir = path.join(base, 'generated')
    const sourceRows = [
      'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
      'xinyi,seg-1016,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z',
      'xinyi,seg-181,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z',
      'xinyi,seg-478,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z',
      'xinyi,seg-8953,marked_space_park,LEGAL,field checked,2026-04-25T00:00:00.000Z',
      'xinyi,seg-1671,no_stop,ILLEGAL,field checked,2026-04-25T00:00:00.000Z',
      'xinyi,seg-6567,no_stop,ILLEGAL,field checked,2026-04-25T00:00:00.000Z',
      'xinyi,seg-8124,no_stop,ILLEGAL,field checked,2026-04-25T00:00:00.000Z',
    ].join('\n')
    await fs.writeFile(sourcePath, sourceRows, 'utf-8')
    await fs.writeFile(
      sourcePath.replace(/\.csv$/i, '.manifest.json'),
      `${JSON.stringify(
        {
          csvPath: sourcePath,
          params: { hhmm: '21:00' },
          rows: { total: 7 },
        },
        null,
        2,
      )}\n`,
      'utf-8',
    )
    await fs.writeFile(
      reviewsPath,
      'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt\n',
      'utf-8',
    )
    await fs.mkdir(generatedDir, { recursive: true })
    const inputPaths = {
      districtBounds: path.join(base, 'district_bounds.geojson'),
      redYellow: path.join(base, 'source_red_yellow.geojson'),
      busStops: path.join(base, 'bus_stops.geojson'),
      hydrants: path.join(base, 'hydrants.geojson'),
    }
    await Promise.all(
      Object.values(inputPaths).map((inputPath) =>
        fs.writeFile(inputPath, '{"type":"FeatureCollection","features":[]}', 'utf-8'),
      ),
    )
    await fs.writeFile(
      path.join(generatedDir, 'red_yellow.geojson'),
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          'seg-1016',
          'seg-181',
          'seg-478',
          'seg-8953',
          'seg-1671',
          'seg-6567',
          'seg-8124',
        ].map((segmentId, index) => ({
          type: 'Feature',
          properties: { id: segmentId, color: index < 4 ? 'yellow' : 'red' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.56 + index * 0.001, 25.03],
              [121.5605 + index * 0.001, 25.03],
            ],
          },
        })),
      }),
      'utf-8',
    )
    await fs.writeFile(
      configPath,
      JSON.stringify(
        {
          districtId: 'xinyi',
          districtName: 'Xinyi Test',
          inputs: inputPaths,
          outputs: {
            generatedDir,
            publicDir: path.join(base, 'public'),
          },
          crs: { default: 'EPSG:4326' },
        },
        null,
        2,
      ),
      'utf-8',
    )

    const result = await buildP0PromoteReview({
      sourcePath,
      reviewsPath,
      mergedOutPath,
      configPath,
      outDir,
    })

    expect(result.pass).toBe(true)
    expect(result.apply).toBeNull()
    expect(result.gate?.pass).toBe(true)
    await expect(fs.readFile(mergedOutPath, 'utf-8')).resolves.toBe(sourceRows)
    await expect(fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')).resolves.toContain(
      '"segmentId":"seg-1016"',
    )
    const mergedManifest = JSON.parse(
      await fs.readFile(mergedOutPath.replace(/\.csv$/i, '.manifest.json'), 'utf-8'),
    ) as { csvPath?: string }
    expect(mergedManifest.csvPath).toBe(mergedOutPath)
  })

  it('fails before apply when a reviewed handoff row has no evidence note', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-promote-review-'))
    const sourcePath = path.join(base, 'xinyi-review.csv')
    const reviewsPath = path.join(base, 'xinyi-next-review.csv')
    const mergedOutPath = path.join(base, 'xinyi-review.merged.csv')
    await fs.writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )
    await fs.writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,LEGAL,,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildP0PromoteReview({
      sourcePath,
      reviewsPath,
      mergedOutPath,
    })

    expect(result.pass).toBe(false)
    expect(result.apply).toBeNull()
    expect(result.gate).toBeNull()
    expect(result.errors).toContain(
      'Review handoff row 2: reviewed rows must include reviewNote evidence before P0 promotion.',
    )
    await expect(fs.access(mergedOutPath)).rejects.toThrow()
  })

  it('checks reviewStatus evidence before signOverrideStatus fallback columns', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'p0-promote-review-'))
    const sourcePath = path.join(base, 'xinyi-review.csv')
    const reviewsPath = path.join(base, 'xinyi-next-review.csv')
    const mergedOutPath = path.join(base, 'xinyi-review.merged.csv')
    await fs.writeFile(
      sourcePath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt',
        'xinyi,seg-1,marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )
    await fs.writeFile(
      reviewsPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,signOverrideStatus,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-1,marked_space_park,,LEGAL,,2026-04-20T00:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildP0PromoteReview({
      sourcePath,
      reviewsPath,
      mergedOutPath,
    })

    expect(result.pass).toBe(false)
    expect(result.apply).toBeNull()
    expect(result.gate).toBeNull()
    expect(result.errors).toContain(
      'Review handoff row 2: reviewed rows must include reviewNote evidence before P0 promotion.',
    )
    await expect(fs.access(mergedOutPath)).rejects.toThrow()
  })
})
