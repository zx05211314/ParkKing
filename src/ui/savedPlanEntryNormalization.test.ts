import { describe, expect, it } from 'vitest'
import { buildSharedAppStateSearch } from './shareState'
import { normalizeSavedPlanValue } from './savedPlanEntryNormalization'

describe('normalizeSavedPlanValue', () => {
  it('rejects entries without the required saved-plan identity fields', () => {
    expect(
      normalizeSavedPlanValue({
        title: 'Missing url',
        createdAt: '2026-03-21T10:00:00.000Z',
      }),
    ).toBeNull()
  })

  it('fills route settings from the saved-plan URL share state when fields are missing', () => {
    const search = buildSharedAppStateSearch({
      datasetId: 'taipei',
      filterQuery: '',
      searchResult: null,
      selectedId: 'segment-1',
      selectedParkingSpaceKey: null,
      recommendationRankMode: 'DRIVE',
      routeProfile: 'driving',
      riskMode: 'AGGRESSIVE',
      mode: 'NIGHT',
      radiusMeters: 487,
      actionFilter: 'PARK_ONLY',
      markedSpacesOnly: null,
      hideReportedIllegal: null,
      includeInferred: null,
      activeView: null,
    })

    const normalized = normalizeSavedPlanValue({
      url: `https://parkking.local/${search}`,
      title: 'Night plan',
      createdAt: '2026-03-21T10:00:00.000Z',
    })

    expect(normalized).toMatchObject({
      key: `https://parkking.local/${search}`,
      url: `https://parkking.local/${search}`,
      title: 'Night plan',
      recommendationRankMode: 'DRIVE',
      routeProfile: 'driving',
      riskMode: 'AGGRESSIVE',
      mode: 'NIGHT',
      radiusMeters: 487,
      actionFilter: 'PARK_ONLY',
    })
  })
})
