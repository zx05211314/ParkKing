import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import { describe, expect, it } from 'vitest'
import {
  PAID_CURB_REFERENCE_KIND,
  parsePaidCurbReferencePack,
  type PaidCurbReferencePack,
} from '../../src/data/paidCurbReference'
import { migrateTaoyuanPaidCurbReviewSource } from './migrateTaoyuanPaidCurbReviewSource'
import {
  type CsvRow,
  sha256TaoyuanReviewCsv,
  validateTaoyuanPaidCurbReview,
} from './validateTaoyuanPaidCurbReview'

const sourceHash = (character: string) => character.repeat(64)

const buildPack = (
  sha256: string,
  description: string,
): PaidCurbReferencePack =>
  parsePaidCurbReferencePack({
    schemaVersion: 1,
    regionId: 'taoyuan',
    evidenceKind: PAID_CURB_REFERENCE_KIND,
    geometryAvailable: false,
    legalAnswerEligible: false,
    requiresHumanReview: true,
    source: {
      dataset: 'Taoyuan City curb parking segment list',
      relativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
      sha256,
      recordCount: 1,
    },
    districts: [
      {
        districtId: 'guishan',
        districtName: 'Guishan',
        boundaryFeatureId: '68000070',
        recordCount: 1,
        records: [
          {
            parkingSegmentId: '380',
            description,
            fareDescription: 'fee',
            hasChargingPoint: false,
            sourceTownName: 'Guishan',
          },
        ],
      },
    ],
  })

const reviewCsv = (description: string) =>
  [
    'parking_segment_id,district_id,district_name,description,fare_description,has_charging_point,geometry_available,legal_answer_eligible,source_text_review_status,source_text_review_note',
    `380,guishan,Guishan,${description},fee,false,false,false,APPROVED_SOURCE_TEXT,reviewed`,
    '',
  ].join('\n')

const setup = async () => {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'taoyuan-source-migrate-'))
  const previousReferencePath = path.join(root, 'previous.json')
  const currentReferencePath = path.join(root, 'current.json')
  const evidenceDir = path.join(root, 'evidence')
  const approvalPath = path.join(root, 'approval.csv')
  const outputDir = path.join(root, 'output')
  const previousPack = buildPack(sourceHash('a'), 'old road')
  const currentPack = buildPack(sourceHash('b'), 'new road')
  const csvBuffer = Buffer.from(reviewCsv('old road'), 'utf-8')
  await fs.mkdir(evidenceDir)
  await Promise.all([
    fs.writeFile(previousReferencePath, JSON.stringify(previousPack)),
    fs.writeFile(currentReferencePath, JSON.stringify(currentPack)),
    fs.writeFile(path.join(evidenceDir, 'guishan-paid-curb-review.csv'), csvBuffer),
    fs.writeFile(
      path.join(evidenceDir, 'guishan-paid-curb-review.manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        districtId: 'guishan',
        sourceSha256: previousPack.source.sha256,
        sourceRecordCount: 1,
        reviewRecordCount: 1,
        geometryAvailable: false,
        legalAnswerEligible: false,
        allowedStatuses: [
          'APPROVED_SOURCE_TEXT',
          'NEEDS_CORRECTION',
          'UNCLEAR',
        ],
        reviewCsv: 'guishan-paid-curb-review.csv',
        reviewSha256: sha256TaoyuanReviewCsv(csvBuffer),
        approvedRecordCount: 1,
      }),
    ),
    fs.writeFile(
      approvalPath,
      [
        'parking_segment_id,field,approved_source_text,current_tdx_text,decision,review_note',
        '380,description,old road,new road,ACCEPT_CURRENT_TDX,owner approved',
        '',
      ].join('\n'),
    ),
  ])
  return {
    root,
    previousReferencePath,
    currentReferencePath,
    evidenceDir,
    approvalPath,
    outputDir,
    currentPack,
  }
}

describe('migrateTaoyuanPaidCurbReviewSource', () => {
  it('migrates pinned approvals only across an exact human-approved drift', async () => {
    const fixture = await setup()
    const result = await migrateTaoyuanPaidCurbReviewSource({
      ...fixture,
      receiptPath: path.join(fixture.root, 'receipt.json'),
      now: new Date('2026-07-18T00:00:00.000Z'),
    })
    const reviewBuffer = await fs.readFile(
      path.join(fixture.outputDir, 'guishan-paid-curb-review.csv'),
    )
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(
          fixture.outputDir,
          'guishan-paid-curb-review.manifest.json',
        ),
        'utf-8',
      ),
    )
    const rows = parseCsv(reviewBuffer, {
      columns: true,
      skip_empty_lines: true,
    }) as CsvRow[]

    expect(result.receipt).toMatchObject({
      source: {
        previousSha256: sourceHash('a'),
        currentSha256: sourceHash('b'),
        recordCount: 1,
      },
      totalApprovedRows: 1,
      safety: {
        geometryAvailable: false,
        legalAnswerEligible: false,
      },
    })
    expect(result.receipt.differences).toEqual([
      expect.objectContaining({
        parkingSegmentId: '380',
        field: 'description',
        previousValue: 'old road',
        currentValue: 'new road',
      }),
    ])
    expect(rows[0]).toMatchObject({
      description: 'new road',
      source_text_review_status: 'APPROVED_SOURCE_TEXT',
    })
    expect(
      validateTaoyuanPaidCurbReview({
        pack: fixture.currentPack,
        manifest,
        rows,
        districtId: 'guishan',
        requireApproved: true,
      }),
    ).toMatchObject({ pass: true, approved: true })
  })

  it('fails closed when a source difference is not explicitly accepted', async () => {
    const fixture = await setup()
    await fs.writeFile(
      fixture.approvalPath,
      [
        'parking_segment_id,field,approved_source_text,current_tdx_text,decision,review_note',
        '380,description,old road,new road,,',
        '',
      ].join('\n'),
    )

    await expect(
      migrateTaoyuanPaidCurbReviewSource(fixture),
    ).rejects.toThrow('must explicitly use ACCEPT_CURRENT_TDX')
  })

  it('fails closed when previous approval evidence is not hash-pinned', async () => {
    const fixture = await setup()
    await fs.appendFile(
      path.join(fixture.evidenceDir, 'guishan-paid-curb-review.csv'),
      'tampered\n',
    )

    await expect(
      migrateTaoyuanPaidCurbReviewSource(fixture),
    ).rejects.toThrow('previous review evidence failed the pinned approval gate')
  })
})
