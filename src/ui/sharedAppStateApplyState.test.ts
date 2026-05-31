import { describe, expect, it, vi } from 'vitest'
import {
  applySharedAppStateSnapshot,
  clampSharedRadiusMeters,
  resolveSharedActiveView,
} from './sharedAppStateApplyState'
import type { ApplySharedAppStateSnapshotOptions } from './sharedAppStateApplyTypes'

describe('sharedAppStateApplyState', () => {
  it('clamps radius and resolves active view defaults', () => {
    expect(clampSharedRadiusMeters(80, 500)).toBe(100)
    expect(clampSharedRadiusMeters(3201, 500)).toBe(3000)
    expect(clampSharedRadiusMeters(null, 500)).toBe(500)

    expect(
      resolveSharedActiveView({
        datasetId: null,
        filterQuery: '',
        searchResult: null,
        selectedId: null,
        selectedParkingSpaceKey: null,
        recommendationRankMode: null,
        routeProfile: null,
        riskMode: null,
        mode: null,
        radiusMeters: null,
        actionFilter: null,
        markedSpacesOnly: null,
        hideReportedIllegal: null,
        includeInferred: null,
        activeView: null,
      }),
    ).toBe('LIST')
    expect(
      resolveSharedActiveView({
        datasetId: null,
        filterQuery: '',
        searchResult: {
          id: 'result-1',
          label: 'Test Place',
          center: [121.5, 25.0],
          bounds: null,
        },
        selectedId: null,
        selectedParkingSpaceKey: null,
        recommendationRankMode: null,
        routeProfile: null,
        riskMode: null,
        mode: null,
        radiusMeters: null,
        actionFilter: null,
        markedSpacesOnly: null,
        hideReportedIllegal: null,
        includeInferred: null,
        activeView: null,
      }),
    ).toBe('MAP')
  })

  it('applies shared state resets and derived defaults', () => {
    const setDatasetId = vi.fn()
    const setFilterQuery = vi.fn()
    const setAddressQuery = vi.fn()
    const setGeocodeResults = vi.fn()
    const setGeocodeStatus = vi.fn()
    const setGeocodeError = vi.fn()
    const setSearchAnchor = vi.fn()
    const setSelectedId = vi.fn()
    const setSelectedParkingSpaceKeyBySegment = vi.fn()
    const setRecommendationRankMode = vi.fn()
    const setSelectedRouteProfile = vi.fn()
    const setSelectedRoutePath = vi.fn()
    const setSelectedRouteStatus = vi.fn()
    const setSelectedRouteError = vi.fn()
    const setSelectedTargetRouteEta = vi.fn()
    const setRouteEtaBySegmentId = vi.fn()
    const setRouteEtaStatus = vi.fn()
    const setRouteEtaError = vi.fn()
    const setRiskMode = vi.fn()
    const setActionFilter = vi.fn()
    const setIncludeInferred = vi.fn()
    const setMarkedSpacesOnly = vi.fn()
    const setHideReportedIllegal = vi.fn()
    const setRadiusMeters = vi.fn()
    const setMode = vi.fn()
    const setNowHHMM = vi.fn()
    const setActiveView = vi.fn()

    const options: ApplySharedAppStateSnapshotOptions = {
      nextState: {
        datasetId: 'taipei',
        filterQuery: 'civic',
        searchResult: {
          id: 'place-1',
          label: 'City Hall',
          center: [121.56, 25.04],
          bounds: null,
        },
        selectedId: 'segment-1',
        selectedParkingSpaceKey: 'space-7',
        recommendationRankMode: null,
        routeProfile: null,
        riskMode: null,
        mode: 'NIGHT',
        radiusMeters: 4500,
        actionFilter: null,
        markedSpacesOnly: null,
        hideReportedIllegal: null,
        includeInferred: null,
        activeView: null,
      },
      makeCameraKey: (prefix) => `${prefix}:1`,
      defaultRecommendationRankMode: 'WALK',
      defaultRouteProfile: 'walking',
      defaultRiskMode: 'NEUTRAL',
      defaultRadiusMeters: 600,
      geocodeRequestIdRef: { current: 0 },
      routeRequestIdRef: { current: 0 },
      selectedRouteRequestIdRef: { current: 0 },
      selectedRouteEtaRequestIdRef: { current: 0 },
      setDatasetId,
      setFilterQuery,
      setAddressQuery,
      setGeocodeResults,
      setGeocodeStatus,
      setGeocodeError,
      setSearchAnchor,
      setSelectedId,
      setSelectedParkingSpaceKeyBySegment,
      setRecommendationRankMode,
      setSelectedRouteProfile,
      setSelectedRoutePath,
      setSelectedRouteStatus,
      setSelectedRouteError,
      setSelectedTargetRouteEta,
      setRouteEtaBySegmentId,
      setRouteEtaStatus,
      setRouteEtaError,
      setRiskMode,
      setActionFilter,
      setIncludeInferred,
      setMarkedSpacesOnly,
      setHideReportedIllegal,
      setRadiusMeters,
      setMode,
      setNowHHMM,
      setActiveView,
    }

    applySharedAppStateSnapshot(options)

    expect(options.geocodeRequestIdRef.current).toBe(1)
    expect(options.routeRequestIdRef.current).toBe(1)
    expect(options.selectedRouteRequestIdRef.current).toBe(1)
    expect(options.selectedRouteEtaRequestIdRef.current).toBe(1)
    expect(setDatasetId).toHaveBeenCalledWith('taipei')
    expect(setAddressQuery).toHaveBeenCalledWith('City Hall')
    expect(setSearchAnchor).toHaveBeenCalledWith({
      key: 'share:place-1:1',
      result: options.nextState.searchResult,
    })
    expect(setSelectedParkingSpaceKeyBySegment).toHaveBeenCalledWith({
      'segment-1': 'space-7',
    })
    expect(setRecommendationRankMode).toHaveBeenCalledWith('WALK')
    expect(setSelectedRouteProfile).toHaveBeenCalledWith('walking')
    expect(setRiskMode).toHaveBeenCalledWith('NEUTRAL')
    expect(setRadiusMeters).toHaveBeenCalledWith(3000)
    expect(setMode).toHaveBeenCalledWith('NIGHT')
    expect(setActiveView).toHaveBeenCalledWith('MAP')
  })
})
