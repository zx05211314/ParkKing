import { describe, expect, it } from 'vitest'
import type { CoverageManifest } from './coverageStatus'
import {
  buildTaoyuanPaidCurbReferencePack,
  parseTaoyuanPaidCurbXml,
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
})
