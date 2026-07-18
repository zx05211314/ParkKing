import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CoverageManifest } from './coverageStatus'
import {
  buildTaoyuanPaidCurbReferencePack,
  parseTaoyuanPaidCurbXml,
  writeTaoyuanPaidCurbReference,
  writeTaoyuanPaidCurbReviewBundles,
} from './buildTaoyuanPaidCurbReference'
import { sha256TaoyuanReviewCsv } from './validateTaoyuanPaidCurbReview'

const manifest: CoverageManifest = {
  schemaVersion: 1,
  regions: [
    {
      regionId: 'taoyuan',
      regionName: 'Taoyuan City',
      expectedDistrictCount: 2,
      answerCapability: 'paid-curb-reference-only',
      districts: [
        {
          districtId: 'taoyuan-district',
          districtName: 'Taoyuan',
          boundaryFeatureId: '68000010',
          publishStage: 'source-only',
          requiresHumanReview: true,
        },
        {
          districtId: 'fuxing',
          districtName: 'Fuxing',
          boundaryFeatureId: '68000130',
          publishStage: 'source-only',
          requiresHumanReview: true,
        },
      ],
      aliases: [],
      blockers: [],
    },
  ],
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CurbParkingSegmentList>
  <ParkingSegment>
    <ParkingSegmentID>segment-1</ParkingSegmentID>
    <Description>Road A &amp; Road B</Description>
    <FareDescription>20元/30分鐘</FareDescription>
    <HasChargingPoint>1</HasChargingPoint>
    <City>桃園市</City>
    <CityCode>TAO</CityCode>
    <TownName>桃園區</TownName>
    <TownID>68000010</TownID>
  </ParkingSegment>
</CurbParkingSegmentList>`

describe('buildTaoyuanPaidCurbReference', () => {
  it('parses official source text without inventing geometry', () => {
    expect(parseTaoyuanPaidCurbXml(xml)).toEqual([
      {
        townId: '68000010',
        parkingSegmentId: 'segment-1',
        description: 'Road A & Road B',
        fareDescription: '20元/30分鐘',
        hasChargingPoint: true,
        sourceTownName: '桃園區',
      },
    ])
  })

  it('builds all manifest districts and preserves zero-record coverage', () => {
    const pack = buildTaoyuanPaidCurbReferencePack({
      xml,
      sourceRelativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
      manifest,
    })

    expect(pack).toMatchObject({
      geometryAvailable: false,
      legalAnswerEligible: false,
      requiresHumanReview: true,
      source: { recordCount: 1 },
    })
    expect(pack.source.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(pack.districts).toEqual([
      expect.objectContaining({ districtId: 'taoyuan-district', recordCount: 1 }),
      expect.objectContaining({ districtId: 'fuxing', recordCount: 0, records: [] }),
    ])
  })

  it('rejects records from a different city instead of silently importing them', () => {
    expect(() =>
      parseTaoyuanPaidCurbXml(xml.replace('<CityCode>TAO', '<CityCode>TPE')),
    ).toThrow('has cityCode TPE')
  })

  it('rebuilds the template without overwriting an existing human review CSV', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'taoyuan-reference-review-'))
    const inputPath = path.join(root, 'paid-curb.xml')
    const manifestPath = path.join(root, 'coverage.json')
    const outputPath = path.join(root, 'reference.json')
    const reviewDir = path.join(root, 'review')
    await fs.writeFile(inputPath, xml, 'utf-8')
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf-8')
    const params = {
      inputPath,
      manifestPath,
      outputPath,
      reviewDistrictId: 'taoyuan-district',
      reviewDir,
    }
    await writeTaoyuanPaidCurbReference(params)
    const reviewPath = path.join(
      reviewDir,
      'taoyuan-district-paid-curb-review.csv',
    )
    await fs.writeFile(reviewPath, 'human-reviewed-content\n', 'utf-8')

    await writeTaoyuanPaidCurbReference(params)

    await expect(fs.readFile(reviewPath, 'utf-8')).resolves.toBe(
      'human-reviewed-content\n',
    )
    await expect(
      fs.readFile(
        path.join(
          reviewDir,
          'taoyuan-district-paid-curb-review.template.csv',
        ),
        'utf-8',
      ),
    ).resolves.toContain('source_text_review_status')
  })

  it('builds review handoffs for every non-empty district', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'taoyuan-reference-all-'))
    const inputPath = path.join(root, 'paid-curb.xml')
    const manifestPath = path.join(root, 'coverage.json')
    const outputPath = path.join(root, 'reference.json')
    const reviewDir = path.join(root, 'review')
    await fs.writeFile(inputPath, xml, 'utf-8')
    await fs.writeFile(manifestPath, JSON.stringify(manifest), 'utf-8')

    await writeTaoyuanPaidCurbReference({
      inputPath,
      manifestPath,
      outputPath,
      reviewDistrictId: 'all',
      reviewDir,
    })

    await expect(
      fs.readFile(
        path.join(
          reviewDir,
          'taoyuan-district-paid-curb-review.csv',
        ),
        'utf-8',
      ),
    ).resolves.toContain('segment-1')
    await expect(
      fs.access(path.join(reviewDir, 'fuxing-paid-curb-review.csv')),
    ).rejects.toThrow()
    await expect(
      fs.readFile(path.join(reviewDir, 'README.md'), 'utf-8'),
    ).resolves.toContain('taoyuan-district: review 1 source rows')
  })

  it('seeds only pinned approved tracked evidence into a clean review bundle', async () => {
    const root = await fs.mkdtemp(
      path.join(tmpdir(), 'taoyuan-reference-seed-'),
    )
    const pack = buildTaoyuanPaidCurbReferencePack({
      xml,
      sourceRelativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
      manifest,
    })
    const draftDir = path.join(root, 'draft')
    await writeTaoyuanPaidCurbReviewBundles({
      pack,
      reviewDistrictId: 'taoyuan-district',
      reviewDir: draftDir,
    })
    const baseName = 'taoyuan-district-paid-curb-review'
    const approvedBuffer = Buffer.from(
      (
        await fs.readFile(path.join(draftDir, `${baseName}.csv`), 'utf-8')
      ).replace(
        ',false,false,,\r\n',
        ',false,false,APPROVED_SOURCE_TEXT,reviewed\r\n',
      ),
      'utf-8',
    )
    const evidenceDir = path.join(root, 'evidence')
    await fs.mkdir(evidenceDir, { recursive: true })
    await fs.writeFile(
      path.join(evidenceDir, `${baseName}.csv`),
      approvedBuffer,
    )
    await fs.writeFile(
      path.join(evidenceDir, `${baseName}.manifest.json`),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          districtId: 'taoyuan-district',
          sourceSha256: pack.source.sha256,
          sourceRecordCount: pack.source.recordCount,
          reviewRecordCount: 1,
          geometryAvailable: false,
          legalAnswerEligible: false,
          allowedStatuses: [
            'APPROVED_SOURCE_TEXT',
            'NEEDS_CORRECTION',
            'UNCLEAR',
          ],
          reviewCsv: `${baseName}.csv`,
          reviewSha256: sha256TaoyuanReviewCsv(approvedBuffer),
          approvedRecordCount: 1,
        },
        null,
        2,
      )}\n`,
      'utf-8',
    )

    const reviewDir = path.join(root, 'review')
    const result = await writeTaoyuanPaidCurbReviewBundles({
      pack,
      reviewDistrictId: 'all',
      reviewDir,
      reviewEvidenceDir: evidenceDir,
    })

    expect(result.seededDistrictIds).toEqual(['taoyuan-district'])
    await expect(
      fs.readFile(path.join(reviewDir, `${baseName}.csv`)),
    ).resolves.toEqual(approvedBuffer)
  })

  it('fails closed when tracked review evidence is not pinned to its CSV', async () => {
    const root = await fs.mkdtemp(
      path.join(tmpdir(), 'taoyuan-reference-bad-seed-'),
    )
    const pack = buildTaoyuanPaidCurbReferencePack({
      xml,
      sourceRelativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
      manifest,
    })
    const evidenceDir = path.join(root, 'evidence')
    const baseName = 'taoyuan-district-paid-curb-review'
    await fs.mkdir(evidenceDir, { recursive: true })
    await fs.writeFile(
      path.join(evidenceDir, `${baseName}.csv`),
      'not,the,approved,csv\n',
      'utf-8',
    )
    await fs.writeFile(
      path.join(evidenceDir, `${baseName}.manifest.json`),
      `${JSON.stringify({
        schemaVersion: 1,
        districtId: 'taoyuan-district',
        sourceSha256: pack.source.sha256,
        sourceRecordCount: pack.source.recordCount,
        reviewRecordCount: 1,
        geometryAvailable: false,
        legalAnswerEligible: false,
        allowedStatuses: [
          'APPROVED_SOURCE_TEXT',
          'NEEDS_CORRECTION',
          'UNCLEAR',
        ],
        reviewCsv: `${baseName}.csv`,
        reviewSha256: '0'.repeat(64),
        approvedRecordCount: 1,
      })}\n`,
      'utf-8',
    )

    await expect(
      writeTaoyuanPaidCurbReviewBundles({
        pack,
        reviewDistrictId: 'taoyuan-district',
        reviewDir: path.join(root, 'review'),
        reviewEvidenceDir: evidenceDir,
      }),
    ).rejects.toThrow(
      'Tracked Taoyuan review evidence for taoyuan-district failed validation',
    )
  })
})
