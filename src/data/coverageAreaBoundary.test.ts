import { describe, expect, it } from 'vitest'
import {
  COVERAGE_AREA_BOUNDARY_KIND,
  getCoverageAreaBoundaryFileName,
  getCoverageAreaBoundaryUrl,
  parseCoverageAreaBoundaryPack,
} from './coverageAreaBoundary'

const pack = {
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
    sourceFeatureCount: 2,
    selectedFeatureCount: 2,
    selectedSourceFeatureIds: ['feature-1', 'feature-2'],
    memberFeatureIds: ['village-1'],
    clippedOutsideSquareMeters: 0,
    boundaryBBox: [121.49, 25.09, 121.54, 25.15],
    parkingAnswerOwnerDistrictId: 'beitou',
  },
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.49, 25.09],
            [121.54, 25.09],
            [121.54, 25.15],
            [121.49, 25.09],
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
} as const

describe('coverageAreaBoundary', () => {
  it('parses a boundary pack with pinned source lineage', () => {
    expect(parseCoverageAreaBoundaryPack(pack).metadata).toMatchObject({
      areaId: 'shipai',
      selectedFeatureCount: 2,
      parkingAnswerOwnerDistrictId: 'beitou',
    })
  })

  it('rejects source feature lineage that does not match the selected count', () => {
    expect(() =>
      parseCoverageAreaBoundaryPack({
        ...pack,
        metadata: {
          ...pack.metadata,
          selectedSourceFeatureIds: ['feature-1'],
        },
      }),
    ).toThrow('Invalid coverage area boundary metadata')
  })

  it('builds safe public artifact paths', () => {
    expect(getCoverageAreaBoundaryFileName('shipai')).toBe(
      'shipai-boundary.geojson',
    )
    expect(getCoverageAreaBoundaryUrl('shipai')).toBe(
      '/data/reference/shipai-boundary.geojson',
    )
    expect(() => getCoverageAreaBoundaryFileName('../shipai')).toThrow(
      'Invalid coverage area boundary id',
    )
  })
})
