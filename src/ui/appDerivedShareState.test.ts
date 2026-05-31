import { describe, expect, it } from 'vitest'
import {
  buildSharedAppState,
  hasShareableAppState,
} from './appDerivedShareState'

describe('appDerivedShareState', () => {
  it('builds the shared app state payload from current selection and filters', () => {
    expect(
      buildSharedAppState({
        actionFilter: 'STOP_OK',
        activeView: 'MAP',
        datasetId: 'xinyi',
        filterQuery: 'city hall',
        hideReportedIllegal: true,
        includeInferred: true,
        markedSpacesOnly: false,
        mode: 'NOW',
        radiusMeters: 500,
        recommendationRankMode: 'DRIVE',
        riskMode: 'NEUTRAL',
        searchAnchor: {
          result: {
            id: 'place-1',
            label: 'City Hall',
            center: [121.56, 25.03],
            bounds: null,
          },
        },
        selectedId: 'seg-1',
        selectedParkingShareKey: 'space-1',
        selectedRouteProfile: 'driving',
      }),
    ).toEqual({
      datasetId: 'xinyi',
      filterQuery: 'city hall',
      searchResult: {
        id: 'place-1',
        label: 'City Hall',
        center: [121.56, 25.03],
        bounds: null,
      },
      selectedId: 'seg-1',
      selectedParkingSpaceKey: 'space-1',
      recommendationRankMode: 'DRIVE',
      routeProfile: 'driving',
      riskMode: 'NEUTRAL',
      mode: 'NOW',
      radiusMeters: 500,
      actionFilter: 'STOP_OK',
      markedSpacesOnly: false,
      hideReportedIllegal: true,
      includeInferred: true,
      activeView: 'MAP',
    })
  })

  it('detects whether the current state is shareable beyond defaults', () => {
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
      hasShareableAppState({
        actionFilter: 'PARK_ONLY',
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
    ).toBe(true)
  })
})
