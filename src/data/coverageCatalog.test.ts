import { describe, expect, it } from 'vitest'
import {
  findCoverageDistrictByLocation,
  getRuntimeCoverageCatalogUrl,
  isLocationInCoverageDistrict,
  parseRuntimeCoverageCatalog,
  type RuntimeCoverageCatalog,
  type RuntimeCoverageDistrict,
} from './coverageCatalog'

const district: RuntimeCoverageDistrict = {
  regionId: 'taipei',
  regionName: 'Taipei City',
  districtId: 'beitou',
  districtName: 'Beitou',
  boundaryFeatureId: '63012',
  publishStage: 'candidate',
  answerCapability: 'full-rule-pipeline',
  requiresHumanReview: true,
  aliases: [{ areaId: 'shipai', areaName: 'Shipai' }],
  boundaryBBox: [121.4, 25.1, 121.6, 25.3],
  boundaryGeometry: {
    type: 'Polygon',
    coordinates: [
      [
        [121.4, 25.1],
        [121.6, 25.1],
        [121.4, 25.3],
        [121.4, 25.1],
      ],
    ],
  },
}

const catalog: RuntimeCoverageCatalog = {
  schemaVersion: 1,
  districts: [district],
}

describe('coverageCatalog', () => {
  it('parses a valid catalog and preserves aliases', () => {
    const parsed = parseRuntimeCoverageCatalog(catalog)
    expect(parsed.districts[0]?.aliases).toEqual([
      { areaId: 'shipai', areaName: 'Shipai' },
    ])
  })

  it('rejects catalogs with unsupported stages', () => {
    expect(() =>
      parseRuntimeCoverageCatalog({
        ...catalog,
        districts: [{ ...district, publishStage: 'reviewed-ish' }],
      }),
    ).toThrow('Invalid runtime coverage catalog')
  })

  it('rejects reference metadata that claims legal-answer eligibility', () => {
    expect(() =>
      parseRuntimeCoverageCatalog({
        ...catalog,
        districts: [
          {
            ...district,
            referenceData: {
              kind: 'PAID_CURB_SEGMENT_TEXT',
              url: '/data/reference/taoyuan-paid-curb.json',
              recordCount: 1,
              sourceSha256: 'a'.repeat(64),
              geometryAvailable: false,
              legalAnswerEligible: true,
              requiresHumanReview: true,
            },
          },
        ],
      }),
    ).toThrow('Invalid runtime coverage catalog')
  })

  it('uses polygon geometry instead of accepting every point in the bbox', () => {
    expect(isLocationInCoverageDistrict(district, [121.45, 25.15])).toBe(true)
    expect(isLocationInCoverageDistrict(district, [121.4, 25.1])).toBe(true)
    expect(isLocationInCoverageDistrict(district, [121.55, 25.25])).toBe(false)
  })

  it('excludes polygon holes and supports multipolygons', () => {
    const polygonWithHole: RuntimeCoverageDistrict = {
      ...district,
      boundaryGeometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.4, 25.1],
            [121.6, 25.1],
            [121.6, 25.3],
            [121.4, 25.3],
            [121.4, 25.1],
          ],
          [
            [121.48, 25.18],
            [121.52, 25.18],
            [121.52, 25.22],
            [121.48, 25.22],
            [121.48, 25.18],
          ],
        ],
      },
    }
    expect(isLocationInCoverageDistrict(polygonWithHole, [121.5, 25.2])).toBe(
      false,
    )

    const multiPolygon: RuntimeCoverageDistrict = {
      ...district,
      boundaryGeometry: {
        type: 'MultiPolygon',
        coordinates: [
          polygonWithHole.boundaryGeometry.type === 'Polygon'
            ? polygonWithHole.boundaryGeometry.coordinates
            : [],
          [
            [
              [121.54, 25.24],
              [121.58, 25.24],
              [121.58, 25.28],
              [121.54, 25.28],
              [121.54, 25.24],
            ],
          ],
        ],
      },
    }
    expect(isLocationInCoverageDistrict(multiPolygon, [121.56, 25.26])).toBe(true)
  })

  it('resolves the district containing a location', () => {
    expect(
      findCoverageDistrictByLocation(catalog, [121.45, 25.15])?.districtId,
    ).toBe('beitou')
    expect(findCoverageDistrictByLocation(catalog, [120, 24])).toBeNull()
  })

  it('loads coverage metadata from the app deployment', () => {
    expect(getRuntimeCoverageCatalogUrl()).toBe('/data/coverage.json')
  })
})
