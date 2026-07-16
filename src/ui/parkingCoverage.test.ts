import { describe, expect, it } from 'vitest'
import type {
  RuntimeCoverageCatalog,
  RuntimeCoverageDistrict,
} from '../data/coverageCatalog'
import {
  buildParkingCoverageState,
  isLocationWithinBounds,
} from './parkingCoverage'

const bounds: [[number, number], [number, number]] = [
  [121.5, 25],
  [121.6, 25.1],
]

const makeDistrict = (
  overrides: Partial<RuntimeCoverageDistrict>,
): RuntimeCoverageDistrict => ({
  regionId: 'taipei',
  regionName: 'Taipei City',
  districtId: 'xinyi',
  districtName: 'Xinyi',
  boundaryFeatureId: '63002',
  publishStage: 'production',
  answerCapability: 'full-rule-pipeline',
  requiresHumanReview: false,
  aliases: [],
  boundaryBBox: [121.5, 25, 121.6, 25.1],
  boundaryGeometry: {
    type: 'Polygon',
    coordinates: [
      [
        [121.5, 25],
        [121.6, 25],
        [121.5, 25.1],
        [121.5, 25],
      ],
    ],
  },
  ...overrides,
})

const catalog: RuntimeCoverageCatalog = {
  schemaVersion: 1,
  districts: [
    makeDistrict({}),
    makeDistrict({
      districtId: 'beitou',
      districtName: 'Beitou',
      boundaryFeatureId: '63012',
      publishStage: 'candidate',
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
    }),
    makeDistrict({
      regionId: 'taoyuan',
      regionName: 'Taoyuan City',
      districtId: 'taoyuan-district',
      districtName: 'Taoyuan',
      boundaryFeatureId: '68000010',
      publishStage: 'source-only',
      answerCapability: 'paid-curb-reference-only',
      requiresHumanReview: true,
      boundaryBBox: [121.2, 24.9, 121.4, 25.1],
      boundaryGeometry: {
        type: 'Polygon',
        coordinates: [
          [
            [121.2, 24.9],
            [121.4, 24.9],
            [121.2, 25.1],
            [121.2, 24.9],
          ],
        ],
      },
    }),
  ],
}

describe('parkingCoverage', () => {
  it('accepts locations inside or on the active dataset bounds', () => {
    expect(isLocationWithinBounds([121.55, 25.05], bounds)).toBe(true)
    expect(isLocationWithinBounds([121.5, 25], bounds)).toBe(true)
    expect(
      buildParkingCoverageState({
        location: [121.55, 25.05],
        districtBounds: bounds,
        districtName: 'Xinyi',
      }),
    ).toEqual({
      eligibleLocation: [121.55, 25.05],
      notice: null,
    })
  })

  it('blocks parking evaluation outside the active dataset bounds', () => {
    const state = buildParkingCoverageState({
      location: [121.51, 25.12],
      districtBounds: bounds,
      districtName: 'Xinyi',
    })

    expect(state.eligibleLocation).toBeNull()
    expect(state.notice).toContain('outside the active Xinyi dataset')
    expect(state.notice).toContain('did not calculate a parking legality answer')
  })

  it('does not claim a coverage failure when dataset bounds are unavailable', () => {
    expect(
      buildParkingCoverageState({
        location: [121.51, 25.12],
        districtBounds: null,
        districtName: 'Unknown',
      }),
    ).toEqual({
      eligibleLocation: [121.51, 25.12],
      notice: null,
    })
  })

  it('uses exact active-district geometry instead of the bounding box', () => {
    const state = buildParkingCoverageState({
      location: [121.58, 25.08],
      districtBounds: bounds,
      districtName: 'Xinyi',
      activeDistrictId: 'xinyi',
      coverageCatalog: catalog,
    })

    expect(state.eligibleLocation).toBeNull()
    expect(state.notice).toContain('outside the active Xinyi dataset')
  })

  it('identifies Beitou candidate coverage and its Shipai alias', () => {
    const state = buildParkingCoverageState({
      location: [121.45, 25.15],
      districtBounds: bounds,
      districtName: 'Xinyi',
      activeDistrictId: 'xinyi',
      coverageCatalog: catalog,
    })

    expect(state.eligibleLocation).toBeNull()
    expect(state.notice).toContain('Beitou candidate coverage')
    expect(state.notice).toContain('covers Shipai')
    expect(state.notice).toContain('requires human review')
  })

  it('identifies Taoyuan source-only coverage without claiming legality', () => {
    const state = buildParkingCoverageState({
      location: [121.25, 24.95],
      districtBounds: bounds,
      districtName: 'Xinyi',
      activeDistrictId: 'xinyi',
      coverageCatalog: catalog,
    })

    expect(state.eligibleLocation).toBeNull()
    expect(state.notice).toContain('Taoyuan, Taoyuan City')
    expect(state.notice).toContain('paid-curb reference sources only')
    expect(state.notice).toContain('no parking legality answer')
  })
})
