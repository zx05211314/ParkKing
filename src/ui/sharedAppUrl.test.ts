import { describe, expect, it } from 'vitest'
import {
  buildCurrentSharedAppUrl,
  buildOverriddenSharedAppUrl,
  buildShareSearchValue,
} from './sharedAppUrl'
import type { SharedAppState } from './shareState'

const baseState: SharedAppState = {
  datasetId: 'xinyi',
  filterQuery: 'city hall',
  searchResult: null,
  selectedId: 'seg-42',
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
  activeView: 'MAP',
}

describe('sharedAppUrl', () => {
  it('builds search and current share urls from pure helpers', () => {
    expect(buildShareSearchValue(baseState, true)).toBe(
      '?dataset=xinyi&filter=city+hall&segment=seg-42&view=MAP',
    )
    expect(
      buildCurrentSharedAppUrl({
        sharedAppState: baseState,
        hasShareableState: true,
        location: {
          origin: 'https://park.example.com',
          pathname: '/app',
          hash: '#map',
        },
      }),
    ).toBe('https://park.example.com/app?dataset=xinyi&filter=city+hall&segment=seg-42&view=MAP#map')
  })

  it('returns null when location is unavailable and applies overrides when present', () => {
    expect(
      buildCurrentSharedAppUrl({
        sharedAppState: baseState,
        hasShareableState: true,
        location: null,
      }),
    ).toBeNull()

    expect(
      buildOverriddenSharedAppUrl({
        sharedAppState: baseState,
        overrides: {
          filterQuery: '',
          selectedId: 'seg-7',
        },
        location: {
          origin: 'https://park.example.com',
          pathname: '/app',
        },
      }),
    ).toBe('https://park.example.com/app?dataset=xinyi&segment=seg-7&view=MAP')
  })
})
