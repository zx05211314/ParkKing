import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CoverageManifest } from './coverageStatus'
import {
  buildTaoyuanPaidCurbReferencePack,
  parseTaoyuanPaidCurbXml,
  writeTaoyuanPaidCurbReference,
} from './buildTaoyuanPaidCurbReference'

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
})
