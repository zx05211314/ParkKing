import { featureCollection, polygon } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import type { CoverageManifest } from './coverageStatus'
import { buildRuntimeCoverageCatalog } from './buildRuntimeCoverageCatalog'
import {
  validateRuntimeCoverageCatalog,
  validateRuntimeCoverageReferences,
} from './validateRuntimeCoverageCatalog'
import type { PaidCurbReferencePack } from '../../src/data/paidCurbReference'

const manifest: CoverageManifest = {
  schemaVersion: 1,
  regions: [
    {
      regionId: 'taipei',
      regionName: 'Taipei City',
      expectedDistrictCount: 1,
      answerCapability: 'full-rule-pipeline',
      districts: [
        {
          districtId: 'beitou',
          districtName: 'Beitou',
          boundaryFeatureId: '63012',
          publishStage: 'candidate',
          configPath: 'configs/expansion/beitou.json',
          requiresHumanReview: true,
        },
      ],
      aliases: [
        {
          areaId: 'shipai',
          areaName: 'Shipai',
          parentDistrictId: 'beitou',
          coverageMode: 'parent-district',
          standaloneBoundaryRequired: true,
        },
      ],
      blockers: [],
    },
  ],
}

const boundaries = new Map([
  [
    'taipei',
    featureCollection([
      polygon(
        [
          [
            [121.4, 25.1],
            [121.6, 25.1],
            [121.6, 25.3],
            [121.4, 25.3],
            [121.4, 25.1],
          ],
        ],
        { PERF_ID: 63012 },
      ),
    ]),
  ],
])

describe('buildRuntimeCoverageCatalog', () => {
  it('joins manifest status to authoritative boundary geometry', () => {
    const catalog = buildRuntimeCoverageCatalog(manifest, boundaries, {
      simplifyTolerance: 0,
    })

    expect(catalog.districts).toHaveLength(1)
    expect(catalog.districts[0]).toMatchObject({
      districtId: 'beitou',
      publishStage: 'candidate',
      answerCapability: 'full-rule-pipeline',
      aliases: [
        {
          areaId: 'shipai',
          areaName: 'Shipai',
          coverageMode: 'parent-district',
          standaloneBoundaryRequired: true,
        },
      ],
      boundaryBBox: [121.4, 25.1, 121.6, 25.3],
      boundaryGeometry: { type: 'Polygon' },
    })
  })

  it('fails when a manifest district has no authoritative boundary', () => {
    expect(() =>
      buildRuntimeCoverageCatalog(
        manifest,
        new Map([['taipei', featureCollection([])]]),
      ),
    ).toThrow('taipei: boundary 63012 was not found')
  })

  it('detects runtime status drift from the manifest', () => {
    const catalog = buildRuntimeCoverageCatalog(manifest, boundaries, {
      simplifyTolerance: 0,
    })
    const valid = validateRuntimeCoverageCatalog(manifest, catalog)
    expect(valid.valid).toBe(true)

    const drifted = {
      ...catalog,
      districts: [
        {
          ...catalog.districts[0]!,
          publishStage: 'production' as const,
        },
      ],
    }
    const invalid = validateRuntimeCoverageCatalog(manifest, drifted)
    expect(invalid.valid).toBe(false)
    expect(invalid.errors).toContain(
      'beitou: publishStage is production, expected candidate',
    )
  })

  it('attaches non-legal reference metadata to source-only districts', () => {
    const taoyuanManifest: CoverageManifest = {
      schemaVersion: 1,
      regions: [
        {
          regionId: 'taoyuan',
          regionName: 'Taoyuan City',
          expectedDistrictCount: 1,
          answerCapability: 'paid-curb-reference-only',
          districts: [
            {
              districtId: 'taoyuan-district',
              districtName: 'Taoyuan',
              boundaryFeatureId: '68000010',
              publishStage: 'source-only',
              requiresHumanReview: true,
            },
          ],
          aliases: [],
          blockers: [],
        },
      ],
    }
    const taoyuanBoundaries = new Map([
      [
        'taoyuan',
        featureCollection([
          polygon(
            [
              [
                [121.2, 24.9],
                [121.4, 24.9],
                [121.4, 25.1],
                [121.2, 24.9],
              ],
            ],
            { TOWNCODE: '68000010' },
          ),
        ]),
      ],
    ])
    const referenceData = {
      kind: 'PAID_CURB_SEGMENT_TEXT' as const,
      url: '/data/reference/taoyuan-paid-curb.json',
      recordCount: 270,
      sourceSha256: 'a'.repeat(64),
      geometryAvailable: false as const,
      legalAnswerEligible: false as const,
      requiresHumanReview: true as const,
    }
    const catalog = buildRuntimeCoverageCatalog(
      taoyuanManifest,
      taoyuanBoundaries,
      {
        simplifyTolerance: 0,
        referencesByBoundaryFeatureId: new Map([
          ['68000010', referenceData],
        ]),
      },
    )

    expect(catalog.districts[0]?.referenceData).toEqual(referenceData)
    expect(validateRuntimeCoverageCatalog(taoyuanManifest, catalog).valid).toBe(
      true,
    )
    const pack: PaidCurbReferencePack = {
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
        recordCount: 270,
      },
      districts: [
        {
          districtId: 'taoyuan-district',
          districtName: 'Taoyuan',
          boundaryFeatureId: '68000010',
          recordCount: 270,
          records: Array.from({ length: 270 }, (_, index) => ({
            parkingSegmentId: String(index),
            description: `Road ${index}`,
            fareDescription: null,
            hasChargingPoint: false,
            sourceTownName: 'Taoyuan',
          })),
        },
      ],
    }
    expect(validateRuntimeCoverageReferences(catalog, pack)).toEqual([])
    expect(
      validateRuntimeCoverageReferences(catalog, {
        ...pack,
        source: { ...pack.source, sha256: 'b'.repeat(64) },
      }),
    ).toContain(
      `taoyuan-district: reference sourceSha256 is ${'a'.repeat(64)}, expected ${'b'.repeat(64)}`,
    )
  })
})
