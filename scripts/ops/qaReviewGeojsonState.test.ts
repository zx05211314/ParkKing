import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildQaReviewGeojson } from './qaReviewGeojsonState'

describe('buildQaReviewGeojson', () => {
  it('writes review point GeoJSON from a handoff CSV', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-geojson-'))
    const inputPath = path.join(base, 'next-review.csv')
    const outPath = path.join(base, 'next-review.geojson')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,score,tier,allowedNow,parkingSpaceCount,topReasons,flags,mapsUrl,streetViewUrl,reviewPlanRank,reviewPlanReason,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-478,marked_space_park,25.033,121.566,5,GREEN,PARK,2,"[""PARKING_SPACE_EVIDENCE""]","[""staleData""]",https://maps.example.test,https://streetview.example.test,1,bucket:marked_space_park,LEGAL,street sign allows parking,2026-05-08T08:00:00.000Z',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGeojson({ inputPath, outPath })

    expect(result.pass).toBe(true)
    expect(result.featureCount).toBe(1)
    expect(result.collection.features[0]?.geometry.coordinates).toEqual([
      121.566,
      25.033,
    ])
    expect(result.collection.features[0]?.properties?.segmentId).toBe('seg-478')
    expect(result.collection.features[0]?.properties?.topReasons).toBe(
      '["PARKING_SPACE_EVIDENCE"]',
    )
    expect(result.collection.features[0]?.properties?.flags).toBe('["staleData"]')
    expect(result.collection.features[0]?.properties?.reviewNote).toBe(
      'street sign allows parking',
    )
    expect(result.collection.features[0]?.properties?.createdAt).toBe(
      '2026-05-08T08:00:00.000Z',
    )
    expect(result.collection.features[0]?.properties?.reviewEvidenceComplete).toBe(
      'true',
    )
    expect(result.collection.features[0]?.properties?.reviewEvidenceTimestampValid).toBe(
      'true',
    )
    await expect(fs.readFile(outPath, 'utf-8')).resolves.toContain('"FeatureCollection"')
  })

  it('marks reviewed points with incomplete evidence', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-geojson-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-478,marked_space_park,25.033,121.566,LEGAL,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGeojson({ inputPath })

    expect(result.pass).toBe(true)
    expect(result.collection.features[0]?.properties?.reviewEvidenceComplete).toBe(
      'false',
    )
    expect(result.collection.features[0]?.properties?.reviewEvidenceMissing).toBe(
      'reviewNote,createdAt',
    )
  })

  it('marks reviewed points with invalid timestamps as incomplete evidence', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-geojson-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-478,marked_space_park,25.033,121.566,LEGAL,field checked,not-a-date',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGeojson({ inputPath })
    const properties = result.collection.features[0]?.properties

    expect(result.pass).toBe(true)
    expect(properties?.reviewEvidenceComplete).toBe('false')
    expect(properties?.reviewEvidenceTimestampValid).toBe('false')
    expect(properties?.reviewEvidenceInvalid).toBe('createdAt')
  })

  it('does not promote signOverrideStatus into reviewStatus properties', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-geojson-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,signOverrideStatus,reviewStatus,reviewNote,createdAt',
        '2,xinyi,seg-478,marked_space_park,25.033,121.566,LEGAL,,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewGeojson({ inputPath })
    const properties = result.collection.features[0]?.properties

    expect(result.pass).toBe(true)
    expect(properties?.signOverrideStatus).toBe('LEGAL')
    expect(properties?.reviewStatus).toBeUndefined()
    expect(properties?.reviewEvidenceComplete).toBeUndefined()
  })

  it('fails when required handoff columns are missing', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-geojson-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(inputPath, 'districtId,segmentId\nxinyi,seg-1\n', 'utf-8')

    const result = await buildQaReviewGeojson({ inputPath })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Next-review CSV is missing required column sourceRowNumber.',
    )
    expect(result.errors).toContain('Next-review CSV is missing required column lat.')
  })
})
