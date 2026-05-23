import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildAnswerCasesFromReviewRows,
  parseWriteAnswerCasesArgs,
  writeAnswerCases,
} from './writeAnswerCases'

describe('writeAnswerCases', () => {
  it('parses CLI options', () => {
    expect(
      parseWriteAnswerCasesArgs([
        'node',
        'writeAnswerCases',
        '--input',
        '.tmp/xinyi-review.merged.csv',
        '--dataset-dir',
        'public/data/generated/xinyi',
        '--out',
        'configs/prod/xinyi.answer-cases.json',
        '--district',
        'xinyi',
        '--hhmm',
        '21:00',
        '--radius',
        '25',
        '--no-validate',
      ]),
    ).toEqual({
      inputPath: '.tmp/xinyi-review.merged.csv',
      datasetDir: 'public/data/generated/xinyi',
      outPath: 'configs/prod/xinyi.answer-cases.json',
      districtId: 'xinyi',
      hhmm: '21:00',
      searchRadiusMeters: 25,
      validate: false,
    })
  })

  it('builds answer cases from reviewed QA rows', () => {
    const cases = buildAnswerCasesFromReviewRows({
      districtId: 'xinyi',
      hhmm: '21:00',
      searchRadiusMeters: 25,
      rows: [
        {
          districtId: 'xinyi',
          segmentId: 'seg-1',
          lat: '25.03',
          lon: '121.56',
          reviewStatus: 'LEGAL',
          finalConfidence: 'HIGH',
          parkingSpaceCount: '2',
          sourceType: 'CURB',
        },
        {
          districtId: 'xinyi',
          segmentId: 'candidate-1',
          lat: '25.04',
          lon: '121.57',
          reviewStatus: 'ILLEGAL',
          finalConfidence: 'LOW',
          parkingSpaceCount: '0',
          sourceType: 'INFERRED',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-2',
          lat: '25.05',
          lon: '121.58',
          reviewStatus: 'UNCLEAR',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-3',
          lat: '25.06',
          lon: '121.59',
          reviewStatus: '',
          signOverrideStatus: 'LEGAL',
        },
      ],
    })

    expect(cases).toHaveLength(2)
    expect(cases[0]).toMatchObject({
      id: 'xinyi-reviewed-legal-seg-1',
      lng: 121.56,
      lat: 25.03,
      expectedKind: 'PARK',
      expectedEvidenceKind: 'MARKED_SPACE',
      expectedPrimarySegmentId: 'seg-1',
      expectedFinalConfidence: 'HIGH',
      minParkingSpaceCount: 2,
    })
    expect(cases[1]).toMatchObject({
      id: 'xinyi-reviewed-illegal-candidate-1',
      expectedKind: 'NO_STOP',
      expectedEvidenceKind: 'INFERRED',
      includeInferred: true,
    })
  })

  it('writes a source-controlled answer case file from a review CSV', async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'write-answer-cases-'))
    const datasetDir = path.join(base, 'dataset')
    const inputPath = path.join(base, 'review.csv')
    const outPath = path.join(base, 'xinyi.answer-cases.json')
    await fs.mkdir(datasetDir, { recursive: true })
    await fs.writeFile(
      path.join(datasetDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi', datasetHash: 'hash-1' }),
      'utf-8',
    )
    await fs.writeFile(
      inputPath,
      [
        'districtId,segmentId,lat,lon,reviewStatus,finalConfidence,parkingSpaceCount,sourceType',
        'xinyi,seg-1,25.03,121.56,LEGAL,HIGH,2,CURB',
      ].join('\n'),
      'utf-8',
    )

    const result = await writeAnswerCases({
      inputPath,
      datasetDir,
      outPath,
      districtId: 'xinyi',
      validate: false,
    })
    const output = JSON.parse(await fs.readFile(outPath, 'utf-8')) as {
      datasetHash: string
      cases: unknown[]
    }

    expect(result.pass).toBe(true)
    expect(result.casesWritten).toBe(1)
    expect(output.datasetHash).toBe('hash-1')
    expect(output.cases).toHaveLength(1)
  })
})
