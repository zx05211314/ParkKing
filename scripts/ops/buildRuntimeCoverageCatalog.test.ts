import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { featureCollection, polygon } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import type { CoverageManifest } from './coverageStatus'
import {
  buildRuntimeCoverageCatalog,
  discoverTaoyuanSpatialReferencePaths,
  loadTaoyuanCoverageReferences,
  sha256RuntimeReferenceData,
} from './buildRuntimeCoverageCatalog'
import {
  validateRuntimeCoverageCatalog,
  validateRuntimeCoverageReferences,
  validateRuntimeCoverageSpatialReference,
  validateRuntimeCoverageSpatialReferences,
} from './validateRuntimeCoverageCatalog'
import type { PaidCurbReferencePack } from '../../src/data/paidCurbReference'
import type { PaidCurbSpatialReferencePack } from '../../src/data/paidCurbSpatialReference'
import {
  COVERAGE_AREA_BOUNDARY_KIND,
  parseCoverageAreaBoundaryPack,
} from '../../src/data/coverageAreaBoundary'

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
  it('hashes runtime reference text consistently across checkout line endings', () => {
    expect(
      sha256RuntimeReferenceData(Buffer.from('{"type":"FeatureCollection"}\r\n')),
    ).toBe(
      sha256RuntimeReferenceData(Buffer.from('{"type":"FeatureCollection"}\n')),
    )
  })

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

  it('attaches and verifies a standalone alias boundary with source lineage', () => {
    const boundaryValue = {
      type: 'FeatureCollection',
      metadata: {
        schemaVersion: 1,
        areaId: 'shipai',
        areaName: 'Shipai',
        parentDistrictId: 'beitou',
        boundaryKind: COVERAGE_AREA_BOUNDARY_KIND,
        sourceDataset: 'Official neighborhoods',
        sourceUrl: 'https://example.test/neighborhoods.zip',
        sourceSha256: 'a'.repeat(64),
        definitionSource: 'Official district office',
        definitionUrl: 'https://example.test/shipai',
        sourceFeatureCount: 1,
        selectedFeatureCount: 1,
        selectedSourceFeatureIds: ['source-feature-1'],
        memberFeatureIds: ['6301200001'],
        clippedOutsideSquareMeters: 0,
        boundaryBBox: [121.42, 25.12, 121.48, 25.18],
        parkingAnswerOwnerDistrictId: 'beitou',
      },
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [121.42, 25.12],
                [121.48, 25.12],
                [121.42, 25.18],
                [121.42, 25.12],
              ],
            ],
          },
          properties: {
            areaId: 'shipai',
            areaName: 'Shipai',
            parentDistrictId: 'beitou',
            boundaryKind: COVERAGE_AREA_BOUNDARY_KIND,
            parkingAnswerOwnerDistrictId: 'beitou',
          },
        },
      ],
    }
    const pack = parseCoverageAreaBoundaryPack(boundaryValue)
    const buffer = Buffer.from(`${JSON.stringify(boundaryValue)}\n`)
    const areaBoundaries = new Map([
      ['shipai', { buffer, pack }],
    ])
    const manifestWithBoundary: CoverageManifest = {
      ...manifest,
      regions: [
        {
          ...manifest.regions[0]!,
          aliases: [
            {
              ...manifest.regions[0]!.aliases[0]!,
              standaloneBoundaryRequired: false,
              boundaryPath: 'public/data/reference/shipai-boundary.geojson',
            },
          ],
        },
      ],
    }
    const catalog = buildRuntimeCoverageCatalog(
      manifestWithBoundary,
      boundaries,
      {
        simplifyTolerance: 0,
        areaBoundariesByAreaId: areaBoundaries,
      },
    )

    expect(catalog.districts[0]?.aliases[0]?.boundary).toMatchObject({
      kind: COVERAGE_AREA_BOUNDARY_KIND,
      sourceSha256: 'a'.repeat(64),
      memberFeatureIds: ['6301200001'],
      parkingAnswerOwnerDistrictId: 'beitou',
    })
    expect(
      validateRuntimeCoverageCatalog(
        manifestWithBoundary,
        catalog,
        areaBoundaries,
        0,
      ).valid,
    ).toBe(true)

    expect(() =>
      buildRuntimeCoverageCatalog(manifestWithBoundary, boundaries, {
        simplifyTolerance: 0,
      }),
    ).toThrow('taipei/shipai: standalone boundary data is missing')
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
      spatialReference: {
        kind: 'PAID_CURB_SEGMENT' as const,
        url: '/data/reference/taoyuan-district-paid-curb-points.geojson',
        dataSha256: 'b'.repeat(64),
        sourceSha256: 'c'.repeat(64),
        reviewSha256: 'd'.repeat(64),
        featureCount: 1,
        excludedFeatureCount: 0,
        geometryPrecision: 'REPRESENTATIVE_POINT' as const,
        legalAnswerEligible: false as const,
      },
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
    const spatialPack = {
      type: 'FeatureCollection',
      metadata: {
        schemaVersion: 1,
        districtId: 'taoyuan-district',
        boundaryFeatureId: '68000010',
        evidenceKind: 'PAID_CURB_SEGMENT',
        sourceDataset: 'TDX OnStreet ParkingSegment v1',
        sourceSha256: 'c'.repeat(64),
        sourceFeatureCount: 1,
        reviewSha256: 'd'.repeat(64),
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
          geometry: {
            type: 'Point',
            coordinates: [121.3, 24.99],
          },
          properties: {
            evidenceKind: 'PAID_CURB_SEGMENT',
            parkingSegmentId: 'segment-1',
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
    } satisfies PaidCurbSpatialReferencePack
    expect(
      validateRuntimeCoverageSpatialReference(
        catalog,
        spatialPack,
        'b'.repeat(64),
      ),
    ).toEqual([])
    expect(
      validateRuntimeCoverageSpatialReference(
        catalog,
        spatialPack,
        'e'.repeat(64),
      ),
    ).toContain(
      `taoyuan-district: spatial reference dataSha256 is ${'b'.repeat(64)}, expected ${'e'.repeat(64)}`,
    )
    expect(
      validateRuntimeCoverageSpatialReferences(catalog, [
        { pack: spatialPack, dataSha256: 'b'.repeat(64) },
      ]),
    ).toEqual([])
    expect(validateRuntimeCoverageSpatialReferences(catalog, [])).toContain(
      'taoyuan-district: catalog spatialReference has no matching runtime pack',
    )
  })

  it('discovers and attaches one reviewed spatial pack per district', async () => {
    const root = await fs.mkdtemp(
      path.join(tmpdir(), 'taoyuan-coverage-references-'),
    )
    const referencePath = path.join(root, 'taoyuan-paid-curb.json')
    const sourceSha256 = 'a'.repeat(64)
    const referencePack: PaidCurbReferencePack = {
      schemaVersion: 1,
      regionId: 'taoyuan',
      evidenceKind: 'PAID_CURB_SEGMENT_TEXT',
      geometryAvailable: false,
      legalAnswerEligible: false,
      requiresHumanReview: true,
      source: {
        dataset: 'Taoyuan City curb parking segment list',
        relativePath: 'source.xml',
        sha256: sourceSha256,
        recordCount: 2,
      },
      districts: [
        {
          districtId: 'taoyuan-district',
          districtName: 'Taoyuan',
          boundaryFeatureId: '68000010',
          recordCount: 1,
          records: [
            {
              parkingSegmentId: 'taoyuan-1',
              description: 'Road A',
              fareDescription: null,
              hasChargingPoint: false,
              sourceTownName: 'Taoyuan',
            },
          ],
        },
        {
          districtId: 'zhongli',
          districtName: 'Zhongli',
          boundaryFeatureId: '68000020',
          recordCount: 1,
          records: [
            {
              parkingSegmentId: 'zhongli-1',
              description: 'Road B',
              fareDescription: null,
              hasChargingPoint: false,
              sourceTownName: 'Zhongli',
            },
          ],
        },
      ],
    }
    await fs.writeFile(referencePath, JSON.stringify(referencePack), 'utf-8')

    for (const [districtId, boundaryFeatureId, parkingSegmentId] of [
      ['taoyuan-district', '68000010', 'taoyuan-1'],
      ['zhongli', '68000020', 'zhongli-1'],
    ] as const) {
      const spatialPack: PaidCurbSpatialReferencePack = {
        type: 'FeatureCollection',
        metadata: {
          schemaVersion: 1,
          districtId,
          boundaryFeatureId,
          evidenceKind: 'PAID_CURB_SEGMENT',
          sourceDataset: 'TDX OnStreet ParkingSegment v1',
          sourceSha256: 'b'.repeat(64),
          sourceFeatureCount: 2,
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
            geometry: { type: 'Point', coordinates: [121.3, 25] },
            properties: {
              evidenceKind: 'PAID_CURB_SEGMENT',
              parkingSegmentId,
              districtId,
              description: 'Road',
              fareDescription: null,
              hasChargingPoint: false,
              geometryPrecision: 'REPRESENTATIVE_POINT',
              legalAnswerEligible: false,
              sourceDataset: 'TDX OnStreet ParkingSegment v1',
            },
          },
        ],
      }
      await fs.writeFile(
        path.join(root, `${districtId}-paid-curb-points.geojson`),
        JSON.stringify(spatialPack),
        'utf-8',
      )
    }
    await fs.writeFile(path.join(root, 'unrelated.geojson'), '{}', 'utf-8')

    const spatialPaths = await discoverTaoyuanSpatialReferencePaths(root)
    const references = await loadTaoyuanCoverageReferences(
      referencePath,
      spatialPaths,
    )

    expect(spatialPaths).toHaveLength(2)
    expect(
      references.get('68000010')?.spatialReference?.url,
    ).toBe('/data/reference/taoyuan-district-paid-curb-points.geojson')
    expect(
      references.get('68000020')?.spatialReference?.url,
    ).toBe('/data/reference/zhongli-paid-curb-points.geojson')

    const roguePath = path.join(root, 'outside-paid-curb-points.geojson')
    const roguePack = JSON.parse(
      await fs.readFile(
        path.join(root, 'zhongli-paid-curb-points.geojson'),
        'utf-8',
      ),
    ) as PaidCurbSpatialReferencePack
    roguePack.metadata.districtId = 'outside'
    roguePack.features[0]!.properties.districtId = 'outside'
    await fs.writeFile(roguePath, JSON.stringify(roguePack), 'utf-8')

    await expect(
      loadTaoyuanCoverageReferences(referencePath, [roguePath]),
    ).rejects.toThrow(
      'Paid-curb spatial reference has unknown Taoyuan district outside',
    )
  })
})
