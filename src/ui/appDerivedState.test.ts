import { describe, expect, it } from 'vitest'
import {
  buildAppDerivedState,
  buildSharedAppState,
  hasShareableAppState,
} from './appDerivedState'

describe('appDerivedState', () => {
  it('builds navigation, share, and dataset display state', () => {
    const result = buildAppDerivedState({
      actionFilter: 'PARK_ONLY',
      activeView: 'MAP',
      datasetId: 'xinyi',
      datasetMeta: {
        districtId: 'xinyi',
        districtName: 'Xinyi',
        datasetHash: 'hash-1',
        schemaVersion: 3,
        boundaryCenter: [121.565, 25.033],
        boundaryBBox: {
          minX: 121.56,
          minY: 25.03,
          maxX: 121.57,
          maxY: 25.04,
        },
      },
      datasetOptions: [
        { id: 'xinyi', label: 'Xinyi' },
        { id: 'daan', label: 'Daan' },
      ],
      defaultRadiusMeters: 400,
      defaultRecommendationRankMode: 'WALK',
      defaultRiskMode: 'NEUTRAL',
      defaultRouteProfile: 'walking',
      defaultSegmentActionFilter: 'ALL',
      filterQuery: 'civic',
      hideReportedIllegal: true,
      includeInferred: true,
      locationLabel: 'Current',
      markedSpacesOnly: true,
      mode: 'NIGHT',
      radiusMeters: 600,
      recommendationRankMode: 'DRIVE',
      riskMode: 'AGGRESSIVE',
      searchAnchor: {
        result: {
          id: 'place-1',
          label: 'City Hall',
          center: [121.5645, 25.0332],
          bounds: null,
        },
      },
      selectedId: 'seg-1',
      selectedParkingSpaceKeyBySegment: {
        'seg-1': 'space-1',
      },
      selectedRouteProfile: 'driving',
      userLocation: [121.55, 25.02],
    })

    expect(result.datasetHash).toBe('hash-1')
    expect(result.districtName).toBe('Xinyi')
    expect(result.schemaVersion).toBe(3)
    expect(result.districtBoundsKey).toBe('xinyi:hash-1')
    expect(result.searchLocationLabel).toBe('City Hall')
    expect(result.navigationOrigin).toEqual([121.5645, 25.0332])
    expect(result.navigationSourceLabel).toBe('Pinned location: City Hall')
    expect(result.selectedParkingShareKey).toBe('space-1')
    expect(result.selectedRouteProfileLabel).toBe('Drive route')
    expect(result.sharedAppState).toEqual({
      datasetId: 'xinyi',
      filterQuery: 'civic',
      searchResult: {
        id: 'place-1',
        label: 'City Hall',
        center: [121.5645, 25.0332],
        bounds: null,
      },
      selectedId: 'seg-1',
      selectedParkingSpaceKey: 'space-1',
      recommendationRankMode: 'DRIVE',
      routeProfile: 'driving',
      riskMode: 'AGGRESSIVE',
      mode: 'NIGHT',
      radiusMeters: 600,
      actionFilter: 'PARK_ONLY',
      markedSpacesOnly: true,
      hideReportedIllegal: true,
      includeInferred: true,
      activeView: 'MAP',
    })
    expect(result.datasetLabelById.get('daan')).toBe('Daan')
    expect(result.hasShareableState).toBe(true)
  })

  it('falls back to defaults when there is no active shareable state', () => {
    expect(
      hasShareableAppState({
        actionFilter: 'ALL',
        activeView: 'LIST',
        defaultRadiusMeters: 500,
        defaultRecommendationRankMode: 'WALK',
        defaultRiskMode: 'NEUTRAL',
        defaultRouteProfile: 'walking',
        defaultSegmentActionFilter: 'ALL',
        filterQuery: '   ',
        hideReportedIllegal: false,
        includeInferred: false,
        markedSpacesOnly: false,
        mode: 'NOW',
        radiusMeters: 500,
        recommendationRankMode: 'WALK',
        riskMode: 'NEUTRAL',
        searchAnchor: null,
        selectedId: null,
        selectedRouteProfile: 'walking',
      }),
    ).toBe(false)

    expect(
      buildSharedAppState({
        actionFilter: 'ALL',
        activeView: 'LIST',
        datasetId: null,
        filterQuery: '',
        hideReportedIllegal: false,
        includeInferred: false,
        markedSpacesOnly: false,
        mode: 'NOW',
        radiusMeters: 500,
        recommendationRankMode: 'WALK',
        riskMode: 'NEUTRAL',
        searchAnchor: null,
        selectedId: null,
        selectedParkingShareKey: null,
        selectedRouteProfile: 'walking',
      }),
    ).toEqual({
      datasetId: null,
      filterQuery: '',
      searchResult: null,
      selectedId: null,
      selectedParkingSpaceKey: null,
      recommendationRankMode: 'WALK',
      routeProfile: 'walking',
      riskMode: 'NEUTRAL',
      mode: 'NOW',
      radiusMeters: 500,
      actionFilter: 'ALL',
      markedSpacesOnly: false,
      hideReportedIllegal: false,
      includeInferred: false,
      activeView: 'LIST',
    })
  })
})
