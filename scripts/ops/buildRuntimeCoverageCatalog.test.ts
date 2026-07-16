import { featureCollection, polygon } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import type { CoverageManifest } from './coverageStatus'
import { buildRuntimeCoverageCatalog } from './buildRuntimeCoverageCatalog'
import { validateRuntimeCoverageCatalog } from './validateRuntimeCoverageCatalog'

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
      aliases: [{ areaId: 'shipai', areaName: 'Shipai' }],
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
})
