import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildQaReviewChecklist } from './qaReviewChecklistState'

describe('buildQaReviewChecklist', () => {
  it('loads focused handoff rows with provenance', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-checklist-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,score,tier,allowedNow,parkingSpaceCount,topReasons,flags,mapsUrl,streetViewUrl,sourceDatasetHash,sourceConfigHash,sourceRowsTotal,reviewPlanRank,reviewPlanReason,reviewStatus,reviewNote,createdAt',
        '8,xinyi,seg-478,marked_space_park,25.033,121.566,96,P0,PARK,2,"[""PARKING_SPACE_EVIDENCE""]","[""staleData""]",https://maps.example.test,https://streetview.example.test,dataset-hash,config-hash,80,1,bucket:marked_space_park,,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewChecklist({
      inputPath,
      sourcePath: path.join(base, 'review.csv'),
      outPath: path.join(base, 'next-review.md'),
      mergedOutPath: path.join(base, 'review.merged.csv'),
      configPath: path.join(base, 'xinyi.json'),
      title: 'Xinyi gate rows',
    })

    expect(result.pass).toBe(true)
    expect(result.title).toBe('Xinyi gate rows')
    expect(result.totalRows).toBe(1)
    expect(result.provenance).toEqual({
      sourceDatasetHash: 'dataset-hash',
      sourceConfigHash: 'config-hash',
      sourceRowsTotal: '80',
    })
    expect(result.rows[0]?.segmentId).toBe('seg-478')
    expect(result.rows[0]?.topReasons).toBe('["PARKING_SPACE_EVIDENCE"]')
    expect(result.rows[0]?.flags).toBe('["staleData"]')
    expect(result.rows[0]?.reviewPlanReason).toBe('bucket:marked_space_park')
  })

  it('fails closed on missing required handoff columns', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-checklist-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(inputPath, 'districtId,segmentId\nxinyi,seg-1\n', 'utf-8')

    const result = await buildQaReviewChecklist({ inputPath })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Next-review CSV is missing required column sourceRowNumber.',
    )
    expect(result.errors).toContain(
      'Next-review CSV is missing required column reviewBucket.',
    )
    expect(result.errors).toContain(
      'Next-review CSV is missing required column reviewStatus.',
    )
  })

  it('fails closed when reviewed handoff rows are missing evidence fields', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-checklist-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,reviewStatus,reviewNote,createdAt',
        '8,xinyi,seg-478,marked_space_park,25.033,121.566,LEGAL,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewChecklist({ inputPath })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Next-review CSV row 2 has reviewStatus but is missing reviewNote or createdAt.',
    )
    expect(result.warnings).toContain(
      '1 row(s) already have reviewStatus; checklist generation verifies status/note/timestamp shape but does not apply them.',
    )
  })

  it('fails closed when reviewed handoff rows have invalid timestamps', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-checklist-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,reviewStatus,reviewNote,createdAt',
        '8,xinyi,seg-478,marked_space_park,25.033,121.566,LEGAL,field checked,not-a-date',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewChecklist({ inputPath })

    expect(result.pass).toBe(false)
    expect(result.errors).toContain(
      'Next-review CSV row 2 has reviewStatus but createdAt must be an ISO timestamp with timezone, for example 2026-05-22T12:00:00.000Z.',
    )
  })

  it('keeps signOverrideStatus separate from blank reviewer status', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-review-checklist-'))
    const inputPath = path.join(base, 'next-review.csv')
    await fs.writeFile(
      inputPath,
      [
        'sourceRowNumber,districtId,segmentId,reviewBucket,lat,lon,signOverrideStatus,reviewStatus,reviewNote,createdAt',
        '8,xinyi,seg-478,marked_space_park,25.033,121.566,LEGAL,,,',
      ].join('\n'),
      'utf-8',
    )

    const result = await buildQaReviewChecklist({ inputPath })

    expect(result.pass).toBe(true)
    expect(result.rowsWithReviewStatus).toBe(0)
    expect(result.rows[0]?.signOverrideStatus).toBe('LEGAL')
    expect(result.rows[0]?.reviewStatus).toBeNull()
  })
})
