import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getTaoyuanPaidCurbReviewPromotionReceiptPath,
  promoteTaoyuanPaidCurbReview,
} from './promoteTaoyuanPaidCurbReview'

const writeJson = async (targetPath: string, value: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  await fs.writeFile(targetPath, buffer)
  return buffer
}

const createFixture = async (status = 'APPROVED_SOURCE_TEXT') => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'taoyuan-review-promote-'))
  const inputDir = path.join(root, 'input')
  const outputDir = path.join(root, 'output')
  const referencePath = path.join(root, 'reference.json')
  const inputPath = path.join(
    inputDir,
    'taoyuan-district-paid-curb-review.csv',
  )
  const manifestPath = path.join(
    inputDir,
    'taoyuan-district-paid-curb-review.manifest.json',
  )
  const sourceSha256 = 'a'.repeat(64)
  await writeJson(referencePath, {
    schemaVersion: 1,
    regionId: 'taoyuan',
    evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
    geometryAvailable: false,
    legalAnswerEligible: false,
    requiresHumanReview: true,
    source: {
      dataset: 'Taoyuan City curb parking segment list',
      relativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
      sha256: sourceSha256,
      recordCount: 1,
    },
    districts: [
      {
        districtId: 'taoyuan-district',
        districtName: 'Taoyuan',
        boundaryFeatureId: '68000010',
        recordCount: 1,
        records: [
          {
            parkingSegmentId: '169',
            description: 'Xianfu Road',
            fareDescription: '20 per 30 minutes',
            hasChargingPoint: false,
            sourceTownName: 'Taoyuan District',
          },
        ],
      },
    ],
  })
  const manifestBuffer = await writeJson(manifestPath, {
    schemaVersion: 1,
    districtId: 'taoyuan-district',
    sourceSha256,
    sourceRecordCount: 1,
    reviewRecordCount: 1,
    geometryAvailable: false,
    legalAnswerEligible: false,
    allowedStatuses: [
      'APPROVED_SOURCE_TEXT',
      'NEEDS_CORRECTION',
      'UNCLEAR',
    ],
  })
  const reviewBuffer = Buffer.from(
    [
      'parking_segment_id,district_id,district_name,description,fare_description,has_charging_point,geometry_available,legal_answer_eligible,source_text_review_status,source_text_review_note',
      `169,taoyuan-district,Taoyuan,Xianfu Road,20 per 30 minutes,false,false,false,${status},Owner reviewed`,
      '',
    ].join('\n'),
    'utf-8',
  )
  await fs.writeFile(inputPath, reviewBuffer)
  return {
    root,
    inputPath,
    manifestPath,
    referencePath,
    outputDir,
    reviewBuffer,
    manifestBuffer,
  }
}

describe('promoteTaoyuanPaidCurbReview', () => {
  it('isolates default promotion receipts by district', () => {
    expect(getTaoyuanPaidCurbReviewPromotionReceiptPath('zhongli')).toBe(
      '.tmp/zhongli-paid-curb-review-promotion.json',
    )
  })

  it('installs only fully approved source-text evidence with a hash receipt', async () => {
    const fixture = await createFixture()
    const receiptPath = path.join(fixture.root, 'receipt.json')
    const result = await promoteTaoyuanPaidCurbReview({
      ...fixture,
      receiptPath,
      now: new Date('2026-07-18T00:00:00.000Z'),
    })

    expect(await fs.readFile(result.destinationReviewPath)).toEqual(
      fixture.reviewBuffer,
    )
    const promotedManifest = JSON.parse(
      await fs.readFile(result.destinationManifestPath, 'utf-8'),
    ) as Record<string, unknown>
    expect(promotedManifest).toMatchObject({
      reviewCsv: 'taoyuan-district-paid-curb-review.csv',
      reviewSha256: createHash('sha256')
        .update(fixture.reviewBuffer)
        .digest('hex'),
      approvedRecordCount: 1,
      geometryAvailable: false,
      legalAnswerEligible: false,
    })
    expect(promotedManifest).not.toHaveProperty('templateCsv')
    expect(JSON.parse(await fs.readFile(receiptPath, 'utf-8'))).toMatchObject({
      schemaVersion: 1,
      promotedAt: '2026-07-18T00:00:00.000Z',
      districtId: 'taoyuan-district',
      source: {
        sourceSha256: 'a'.repeat(64),
        reviewSha256: createHash('sha256')
          .update(fixture.reviewBuffer)
          .digest('hex'),
      },
      destination: {
        manifestSha256: createHash('sha256')
          .update(await fs.readFile(result.destinationManifestPath))
          .digest('hex'),
      },
      validation: {
        approved: true,
        approvedRows: 1,
        expectedRows: 1,
        geometryAvailable: false,
        legalAnswerEligible: false,
      },
    })
  })

  it('rejects pending review before replacing tracked evidence', async () => {
    const fixture = await createFixture('')
    const destinationReviewPath = path.join(
      fixture.outputDir,
      'taoyuan-district-paid-curb-review.csv',
    )
    await fs.mkdir(fixture.outputDir, { recursive: true })
    await fs.writeFile(destinationReviewPath, 'existing-reviewed-evidence')

    await expect(
      promoteTaoyuanPaidCurbReview({
        ...fixture,
        receiptPath: path.join(fixture.root, 'receipt.json'),
      }),
    ).rejects.toThrow('1 source-text review rows are still pending')
    expect(await fs.readFile(destinationReviewPath, 'utf-8')).toBe(
      'existing-reviewed-evidence',
    )
  })

  it('rejects source drift before writing any tracked evidence', async () => {
    const fixture = await createFixture()
    await fs.writeFile(
      fixture.inputPath,
      fixture.reviewBuffer.toString('utf-8').replace('Xianfu Road', 'Changed'),
    )

    await expect(
      promoteTaoyuanPaidCurbReview({
        ...fixture,
        receiptPath: path.join(fixture.root, 'receipt.json'),
      }),
    ).rejects.toThrow('description does not match the reference pack')
    await expect(fs.stat(fixture.outputDir)).rejects.toMatchObject({
      code: 'ENOENT',
    })
  })
})
