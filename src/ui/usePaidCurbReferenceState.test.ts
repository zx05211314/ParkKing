import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeCoverageReferenceData } from '../data/coverageCatalog'
import { loadPaidCurbReferenceDistrict } from './usePaidCurbReferenceState'

const referenceData: RuntimeCoverageReferenceData = {
  kind: 'PAID_CURB_SEGMENT_TEXT',
  url: '/data/reference/taoyuan-paid-curb.json',
  recordCount: 1,
  sourceSha256: 'a'.repeat(64),
  geometryAvailable: false,
  legalAnswerEligible: false,
  requiresHumanReview: true,
}

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
          parkingSegmentId: '169',
          description: '縣府路園區',
          fareDescription: null,
          hasChargingPoint: false,
          sourceTownName: '桃園區',
        },
      ],
    },
  ],
}

describe('usePaidCurbReferenceState loader', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads the requested district after validating catalog provenance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => pack }),
    )
    await expect(
      loadPaidCurbReferenceDistrict({
        districtId: 'taoyuan-district',
        referenceData,
      }),
    ).resolves.toMatchObject({ districtId: 'taoyuan-district', recordCount: 1 })
  })

  it('fails closed when the catalog and public pack hashes differ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => pack }),
    )
    await expect(
      loadPaidCurbReferenceDistrict({
        districtId: 'taoyuan-district',
        referenceData: { ...referenceData, sourceSha256: 'b'.repeat(64) },
      }),
    ).rejects.toThrow('source hash does not match')
  })
})
