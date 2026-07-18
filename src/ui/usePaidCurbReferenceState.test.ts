import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeCoverageReferenceData } from '../data/coverageCatalog'
import { createHash } from 'node:crypto'
import {
  loadPaidCurbReferenceDistrict,
  loadPaidCurbSpatialReference,
} from './usePaidCurbReferenceState'

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

  it('verifies canonical LF hashes for a CRLF runtime checkout', async () => {
    const spatialPack = {
      type: 'FeatureCollection',
      metadata: {
        schemaVersion: 1,
        districtId: 'taoyuan-district',
        boundaryFeatureId: '68000010',
        evidenceKind: 'PAID_CURB_SEGMENT',
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
        sourceSha256: 'b'.repeat(64),
        sourceFeatureCount: 1,
        reviewSha256: 'c'.repeat(64),
        reviewRecordCount: 1,
        featureCount: 1,
        excludedFeatureCount: 0,
        excluded: [],
        geometryPrecision: 'REPRESENTATIVE_POINT',
        legalAnswerEligible: false,
      },
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [121.3, 24.99] },
          properties: {
            evidenceKind: 'PAID_CURB_SEGMENT',
            parkingSegmentId: '169',
            districtId: 'taoyuan-district',
            description: 'Road A',
            fareDescription: null,
            hasChargingPoint: false,
            geometryPrecision: 'REPRESENTATIVE_POINT',
            legalAnswerEligible: false,
            sourceDataset: 'TDX OnStreet ParkingSegment v1',
          },
        },
      ],
    }
    const canonicalBuffer = Buffer.from(
      `${JSON.stringify(spatialPack)}\n`,
      'utf-8',
    )
    const buffer = Buffer.from(`${JSON.stringify(spatialPack)}\r\n`, 'utf-8')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () =>
          buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ),
      }),
    )

    await expect(
      loadPaidCurbSpatialReference({
        districtId: 'taoyuan-district',
        spatialReference: {
          kind: 'PAID_CURB_SEGMENT',
          url: '/data/reference/points.geojson',
          dataSha256: createHash('sha256')
            .update(canonicalBuffer)
            .digest('hex'),
          sourceSha256: 'b'.repeat(64),
          reviewSha256: 'c'.repeat(64),
          featureCount: 1,
          excludedFeatureCount: 0,
          geometryPrecision: 'REPRESENTATIVE_POINT',
          legalAnswerEligible: false,
        },
      }),
    ).resolves.toMatchObject({
      metadata: { featureCount: 1, legalAnswerEligible: false },
    })
  })
})
