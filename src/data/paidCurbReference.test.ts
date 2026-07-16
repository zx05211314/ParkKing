import { describe, expect, it } from 'vitest'
import {
  getPaidCurbReferenceUrl,
  parsePaidCurbReferencePack,
} from './paidCurbReference'

const pack = {
  schemaVersion: 1,
  regionId: 'taoyuan',
  evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
  geometryAvailable: false,
  legalAnswerEligible: false,
  requiresHumanReview: true,
  source: {
    dataset: 'Taoyuan City curb parking segment list',
    relativePath: 'data/sources/taoyuan/paid_curb_segments.xml',
    sha256: 'a'.repeat(64),
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
          parkingSegmentId: 'segment-1',
          description: 'Road A',
          fareDescription: null,
          hasChargingPoint: false,
          sourceTownName: '桃園區',
        },
      ],
    },
  ],
} as const

describe('paidCurbReference', () => {
  it('parses a non-geometric, non-legal reference pack', () => {
    expect(parsePaidCurbReferencePack(pack)).toEqual(pack)
    expect(getPaidCurbReferenceUrl()).toBe(
      '/data/reference/taoyuan-paid-curb.json',
    )
  })

  it('rejects mismatched source and district record counts', () => {
    expect(() =>
      parsePaidCurbReferencePack({
        ...pack,
        source: { ...pack.source, recordCount: 2 },
      }),
    ).toThrow('record count does not match source')
  })

  it('rejects duplicate segment IDs across district partitions', () => {
    expect(() =>
      parsePaidCurbReferencePack({
        ...pack,
        source: { ...pack.source, recordCount: 2 },
        districts: [
          pack.districts[0],
          {
            ...pack.districts[0],
            districtId: 'zhongli',
            boundaryFeatureId: '68000020',
          },
        ],
      }),
    ).toThrow('duplicate segment IDs')
  })
})
