import { describe, expect, it } from 'vitest'
import type {
  CoveragePublishStage,
  RuntimeCoverageCatalog,
  RuntimeCoverageDistrict,
} from './coverageCatalog'
import { buildPinnedCoverageBoundary } from './coverageDisplay'

const buildDistrict = (
  districtId: string,
  publishStage: CoveragePublishStage,
  offset: number,
  aliases: RuntimeCoverageDistrict['aliases'] = [],
): RuntimeCoverageDistrict => ({
  regionId: publishStage === 'source-only' ? 'taoyuan' : 'taipei',
  regionName: publishStage === 'source-only' ? 'Taoyuan City' : 'Taipei City',
  districtId,
  districtName: districtId === 'beitou' ? 'Beitou' : 'Taoyuan',
  boundaryFeatureId: districtId,
  publishStage,
  answerCapability:
    publishStage === 'source-only'
      ? 'paid-curb-reference-only'
      : 'full-rule-pipeline',
  requiresHumanReview: publishStage === 'candidate',
  aliases,
  boundaryBBox: [offset, 25, offset + 0.1, 25.1],
  boundaryGeometry: {
    type: 'Polygon',
    coordinates: [
      [
        [offset, 25],
        [offset + 0.1, 25],
        [offset + 0.1, 25.1],
        [offset, 25.1],
        [offset, 25],
      ],
    ],
  },
})

const catalog: RuntimeCoverageCatalog = {
  schemaVersion: 1,
  districts: [
    buildDistrict('beitou', 'candidate', 121.5, [
      { areaId: 'shipai', areaName: 'Shipai' },
    ]),
    buildDistrict('taoyuan', 'source-only', 121.3),
  ],
}

describe('buildPinnedCoverageBoundary', () => {
  it('returns no boundary without a pinned location or catalog match', () => {
    expect(buildPinnedCoverageBoundary(null, [121.55, 25.05])).toBeNull()
    expect(buildPinnedCoverageBoundary(catalog, null)).toBeNull()
    expect(buildPinnedCoverageBoundary(catalog, [120, 24])).toBeNull()
  })

  it('builds candidate boundary data for a Shipai location in Beitou', () => {
    const boundary = buildPinnedCoverageBoundary(catalog, [121.55, 25.05])

    expect(boundary).toMatchObject({
      districtId: 'beitou',
      districtName: 'Beitou',
      regionName: 'Taipei City',
      publishStage: 'candidate',
      stageLabel: 'Candidate, not published',
    })
    expect(boundary?.data.features).toHaveLength(1)
    expect(boundary?.data.features[0]?.properties).toEqual({
      districtId: 'beitou',
      districtName: 'Beitou',
      regionName: 'Taipei City',
      publishStage: 'candidate',
    })
  })

  it('labels Taoyuan coverage as source-only', () => {
    expect(buildPinnedCoverageBoundary(catalog, [121.35, 25.05])).toMatchObject({
      districtId: 'taoyuan',
      publishStage: 'source-only',
      stageLabel: 'Source only',
    })
  })
})
