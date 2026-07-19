import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { exportOverrides } from './exportOverrides'

describe('exportOverrides', () => {
  it('writes deterministic jsonl output per district', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-'))
    const inputPath = path.join(base, 'reports.json')
    const outDir = path.join(base, 'out')

    const payload = {
      schemaVersion: 2,
      reports: [
        {
          districtId: 'xinyi',
          segmentId: 'seg-2-part-1',
          reviewedSegmentId: 'seg-2-part-1',
          reviewedHhmm: '21:00',
          status: 'ILLEGAL',
          note: 'first check',
          createdAt: '2026-02-02T00:00:00Z',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-2-part-1',
          reviewedSegmentId: 'seg-2-part-1',
          reviewedHhmm: '21:00',
          status: 'LEGAL',
          note: 'second check',
          createdAt: '2026-02-03T00:00:00Z',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-1-part-2',
          reviewedSegmentId: 'seg-1-part-2',
          reviewedHhmm: '21:00',
          status: 'LEGAL',
          note: '  ok  ',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          districtId: 'daan',
          segmentId: 'seg-9',
          reviewedSegmentId: 'seg-9',
          reviewedHhmm: '21:00',
          status: 'UNCLEAR',
          note: 'unclear sign',
          createdAt: '2026-02-01T00:00:00Z',
        },
      ],
    }

    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2), 'utf-8')

    await exportOverrides({ inputPath, outDir })

    const xinyiRaw = await fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')
    const xinyiLines = xinyiRaw.trim().split(/\r?\n/).map((line) => JSON.parse(line))

    expect(xinyiLines).toHaveLength(2)
    expect(xinyiLines[0].segmentId).toBe('seg-1')
    expect(xinyiLines[0].status).toBe('LEGAL')
    expect(xinyiLines[0].note).toBe('ok')
    expect(xinyiLines[1].segmentId).toBe('seg-2')
    expect(xinyiLines[1].status).toBe('LEGAL')
    expect(xinyiLines[1].schemaVersion).toBe(2)
    expect(xinyiLines[1].reviewedSegmentId).toBe('seg-2-part-1')
    expect(xinyiLines[1].reviewedHhmm).toBe('21:00')

    const daanRaw = await fs.readFile(path.join(outDir, 'daan.jsonl'), 'utf-8')
    const daanLines = daanRaw.trim().split(/\r?\n/).map((line) => JSON.parse(line))
    expect(daanLines).toHaveLength(1)
    expect(daanLines[0].segmentId).toBe('seg-9')
    expect(daanLines[0].schemaVersion).toBe(2)
  })

  it('exports completed QA review CSV rows and ignores blank review rows', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-csv-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,lat,lon,score,tier,allowedNow,parkingSpaceCount,topReasons[],flags,mapsUrl,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,25.050000,121.500000,1.0000,GREEN,PARK,2,[],[],https://example.test,LEGAL,field checked,2026-04-20T00:00:00.000Z,21:00',
        'xinyi,seg-2,25.050000,121.500000,0.5000,RED,NO_STOP,0,[],[],https://example.test,,,,',
      ].join('\n'),
      'utf-8',
    )

    await exportOverrides({ inputPath, outDir })

    const xinyiRaw = await fs.readFile(path.join(outDir, 'xinyi.jsonl'), 'utf-8')
    const xinyiLines = xinyiRaw.trim().split(/\r?\n/).map((line) => JSON.parse(line))

    expect(xinyiLines).toHaveLength(1)
    expect(xinyiLines[0]).toMatchObject({
      districtId: 'xinyi',
      segmentId: 'seg-1',
      status: 'LEGAL',
      note: 'field checked',
      createdAt: '2026-04-20T00:00:00.000Z',
    })
  })

  it('does not rewrite unchanged district JSONL outputs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-unchanged-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')
    const outputPath = path.join(outDir, 'xinyi.jsonl')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,LEGAL,field checked,2026-04-20T00:00:00.000Z,21:00',
      ].join('\n'),
      'utf-8',
    )

    await exportOverrides({ inputPath, outDir })

    const previousModifiedAt = new Date('2026-01-01T00:00:00.000Z')
    await fs.utimes(outputPath, previousModifiedAt, previousModifiedAt)
    const before = await fs.stat(outputPath)

    await exportOverrides({ inputPath, outDir })

    const after = await fs.stat(outputPath)
    expect(after.mtimeMs).toBe(before.mtimeMs)
  })

  it('does not export signOverrideStatus evidence when reviewStatus is blank', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-csv-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,signOverrideStatus,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,LEGAL,,,,21:00',
      ].join('\n'),
      'utf-8',
    )

    await expect(exportOverrides({ inputPath, outDir })).rejects.toThrow(
      'No valid reports found to export.',
    )
  })

  it('fails fast for invalid reviewed QA CSV rows instead of silently dropping them', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-bad-csv-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,marked_space_park,MAYBE,bad status,2026-04-20T00:00:00.000Z,21:00',
        'xinyi,,no_stop,LEGAL,missing segment,2026-04-20T00:00:00.000Z,21:00',
      ].join('\n'),
      'utf-8',
    )

    await expect(exportOverrides({ inputPath, outDir })).rejects.toThrow(
      'Invalid QA review CSV',
    )
  })

  it('fails fast for reviewed QA CSV rows missing evidence fields', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-missing-evidence-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,marked_space_park,LEGAL,,,21:00',
      ].join('\n'),
      'utf-8',
    )

    await expect(exportOverrides({ inputPath, outDir })).rejects.toThrow(
      'reviewNote is required when reviewStatus is set',
    )
  })

  it('fails fast for reviewed QA CSV rows with invalid timestamps', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-invalid-time-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewBucket,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,marked_space_park,LEGAL,field checked,not-a-date,21:00',
      ].join('\n'),
      'utf-8',
    )

    await expect(exportOverrides({ inputPath, outDir })).rejects.toThrow(
      'createdAt must be an ISO timestamp with timezone',
    )
  })

  it('fails fast for JSON reports missing evidence notes', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-bad-json-'))
    const inputPath = path.join(base, 'reports.json')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      JSON.stringify({
        reports: [
          {
            districtId: 'xinyi',
            segmentId: 'seg-1',
            reviewedSegmentId: 'seg-1',
            reviewedHhmm: '21:00',
            status: 'LEGAL',
            createdAt: '2026-04-20T00:00:00.000Z',
          },
        ],
      }),
      'utf-8',
    )

    await expect(exportOverrides({ inputPath, outDir })).rejects.toThrow(
      'Invalid override report input',
    )
  })

  it('can re-read a single exported JSONL report as report input', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'overrides-export-single-jsonl-'))
    const inputPath = path.join(base, 'review.csv')
    const outDir = path.join(base, 'out')

    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,reviewStatus,reviewNote,createdAt,reviewedHhmm',
        'xinyi,seg-1,LEGAL,field checked,2026-04-20T00:00:00.000Z,21:00',
      ].join('\n'),
      'utf-8',
    )

    await exportOverrides({ inputPath, outDir })
    await exportOverrides({
      inputPath: path.join(outDir, 'xinyi.jsonl'),
      outDir: path.join(base, 'out-again'),
    })

    const exportedAgain = await fs.readFile(
      path.join(base, 'out-again', 'xinyi.jsonl'),
      'utf-8',
    )
    expect(exportedAgain).toContain('"segmentId":"seg-1"')
  })
})
