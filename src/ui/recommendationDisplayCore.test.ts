import { describe, expect, it } from 'vitest'
import {
  buildRecommendationSelectionState,
  countRecommendationFeedback,
  countRouteAwareRecommendations,
  getBestAddressRecommendationFeedback,
  getBestAddressRecommendationReport,
  getPinnedFavoriteState,
} from './recommendationDisplayCore'
import type { SegmentReport } from '../feedback/reports'
import type { FavoriteAddress } from './recentAddresses'

const report: SegmentReport = {
  schemaVersion: 1,
  districtId: 'xinyi',
  segmentId: 'seg-a',
  status: 'LEGAL',
  createdAt: '2026-03-18T08:00:00.000Z',
}

const favoriteAddress: FavoriteAddress = {
  id: 'addr-a',
  label: '1 Civic Blvd',
  center: [121.565, 25.033],
  bounds: null,
  role: 'HOME',
}

describe('recommendationDisplayCore', () => {
  it('builds recommendation selection state', () => {
    const state = buildRecommendationSelectionState([
      { segment: { id: 'seg-a', name: 'A' } },
      { segment: { id: 'seg-b', name: 'B' } },
    ])

    expect(state.recommendedSegmentIds).toEqual(['seg-a', 'seg-b'])
    expect(state.bestAddressRecommendationTarget?.segment.id).toBe('seg-a')
    expect(state.bestAddressRecommendation?.id).toBe('seg-a')
    expect(state.alternativeAddressRecommendations).toHaveLength(1)
  })

  it('counts feedback and route-aware recommendations', () => {
    const targets = [{ segment: { id: 'seg-a' } }, { segment: { id: 'seg-b' } }]

    expect(countRecommendationFeedback(targets, { 'seg-a': report })).toBe(1)
    expect(
      countRouteAwareRecommendations(targets, 'WALK', {
        'seg-a': {
          walkingDurationSeconds: 120,
          drivingDurationSeconds: null,
        },
        'seg-b': {
          walkingDurationSeconds: null,
          drivingDurationSeconds: 60,
        },
      }),
    ).toBe(1)
  })

  it('derives pinned favorite and best-report details', () => {
    expect(
      getPinnedFavoriteState([favoriteAddress], {
        result: favoriteAddress,
      }),
    ).toEqual({
      isPinnedFavorite: true,
      pinnedFavoriteRole: 'HOME',
    })

    const bestReport = getBestAddressRecommendationReport(
      { id: 'seg-a' },
      { 'seg-a': report },
    )

    expect(bestReport).toEqual(report)
    expect(getBestAddressRecommendationFeedback(bestReport)).toContain(
      'Locally verified legal',
    )
  })
})
