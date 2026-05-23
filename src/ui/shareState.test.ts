import { describe, expect, it } from 'vitest'
import {
  buildSharedAppStateSearch,
  buildSharedAppStateUrl,
  readSharedAppState,
} from './shareState'

describe('shareState', () => {
  it('round-trips a pinned address, selection, and filters through the query string', () => {
    const search = buildSharedAppStateSearch({
      datasetId: 'xinyi',
      filterQuery: 'city hall',
      searchResult: {
        id: 'place-1',
        label: 'Taipei 101, Xinyi District',
        center: [121.564468, 25.033964],
        bounds: [
          [121.5635, 25.0331],
          [121.5652, 25.0346],
        ],
      },
      selectedId: 'seg-42',
      selectedParkingSpaceKey: 'space-7',
      recommendationRankMode: 'WALK',
      routeProfile: 'walking',
      riskMode: 'NEUTRAL',
      mode: 'NOW',
      radiusMeters: 650,
      actionFilter: 'PARK_ONLY',
      markedSpacesOnly: true,
      hideReportedIllegal: true,
      includeInferred: false,
      activeView: 'MAP',
    })

    expect(readSharedAppState(search)).toEqual({
      datasetId: 'xinyi',
      filterQuery: 'city hall',
      searchResult: {
        id: 'place-1',
        label: 'Taipei 101, Xinyi District',
        center: [121.564468, 25.033964],
        bounds: [
          [121.5635, 25.0331],
          [121.5652, 25.0346],
        ],
      },
      selectedId: 'seg-42',
      selectedParkingSpaceKey: 'space-7',
      recommendationRankMode: 'WALK',
      routeProfile: 'walking',
      riskMode: 'NEUTRAL',
      mode: 'NOW',
      radiusMeters: 650,
      actionFilter: 'PARK_ONLY',
      markedSpacesOnly: true,
      hideReportedIllegal: true,
      includeInferred: false,
      activeView: 'MAP',
    })
  })

  it('builds a full URL and skips empty fields', () => {
    const state = {
      datasetId: null,
      filterQuery: '',
      searchResult: null,
      selectedId: 'seg-5',
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
      activeView: 'LIST' as const,
    }

    expect(buildSharedAppStateSearch(state)).toBe('?segment=seg-5&view=LIST')
    expect(
      buildSharedAppStateUrl(state, {
        origin: 'https://park.example.com',
        pathname: '/app',
        hash: '#map',
      }),
    ).toBe('https://park.example.com/app?segment=seg-5&view=LIST#map')
  })

  it('drops invalid enum and boolean values when reading shared state', () => {
    expect(
      readSharedAppState(
        '?rank=INVALID&route=flying&risk=WILD&time=LATER&action=MAYBE&spacesOnly=2&view=GRID',
      ),
    ).toEqual({
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
    })
  })
})
