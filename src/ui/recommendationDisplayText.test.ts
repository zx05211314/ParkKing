import { describe, expect, it } from 'vitest'
import {
  getAddressRecommendationEmptyMessage,
  getAddressRecommendationFeedbackLabel,
  getAddressRecommendationRankingLabel,
  getBestAddressRecommendationReason,
  getEmptySegmentsMessage,
  getRecommendationListSortSummary,
} from './recommendationDisplayText'

describe('recommendationDisplayText', () => {
  it('builds ranking and feedback labels', () => {
    expect(getAddressRecommendationRankingLabel('WALK', 2)).toBe(
      'Ranked by walk ETA to exact targets, then marked spaces',
    )
    expect(getAddressRecommendationRankingLabel('DRIVE', 0)).toBe(
      'Ranked by drive ETA to exact targets with marked-space fallback',
    )
    expect(getAddressRecommendationFeedbackLabel(1)).toBe(
      'Local feedback is adjusting 1 nearby option.',
    )
    expect(getAddressRecommendationFeedbackLabel(0)).toBeNull()
  })

  it('builds deployment-aware ranking labels when live ETA is unavailable', () => {
    expect(
      getAddressRecommendationRankingLabel(
        'WALK',
        0,
        'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
      ),
    ).toBe(
      'Live walk ETA unavailable on this deployment. Ranking falls back to target distance with marked-space support',
    )
    expect(
      getAddressRecommendationRankingLabel(
        'DRIVE',
        0,
        'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
      ),
    ).toBe(
      'Live drive ETA unavailable on this deployment. Ranking falls back to target distance with marked-space support',
    )
  })

  it('builds list sort summaries and best-reason fallback', () => {
    expect(getRecommendationListSortSummary([121.5, 25.0], 'DRIVE', 'loading')).toBe(
      'List sorted by drive ETA when available. Live ETA is still loading.',
    )
    expect(
      getRecommendationListSortSummary(
        [121.5, 25.0],
        'WALK',
        'ready',
        'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
      ),
    ).toBe(
      'List sorted by target distance while live walk ETA is unavailable on this deployment.',
    )
    expect(getRecommendationListSortSummary(null, 'WALK', 'ready')).toBeNull()
    expect(
      getBestAddressRecommendationReason({
        allowedNow: 'PARK',
        tier: 'GREEN',
        sourceType: 'CURB',
        parkingSpaceCount: 4,
        reasonCodes: ['PARKING_SPACE_EVIDENCE'],
      }),
    ).toBe('High-confidence parking backed by mapped official marked spaces')
    expect(
      getBestAddressRecommendationReason({
        allowedNow: 'PARK',
        tier: 'GREEN',
        sourceType: 'CURB',
        parkingSpaceCount: 4,
        dataFreshnessDays: 900,
        reasonCodes: ['PARKING_SPACE_EVIDENCE'],
      }),
    ).toBe(
      'High-confidence parking backed by mapped official marked spaces despite an old curb-paint timestamp',
    )
    expect(
      getBestAddressRecommendationReason({
        reasons: ['Fallback reason'],
      }),
    ).toBe('Fallback reason')
  })

  it('builds empty messages with filter notes', () => {
    expect(
      getEmptySegmentsMessage({
        activeSearchQuery: 'civic',
        markedSpacesOnly: true,
        searchLocationLabel: 'City Hall',
        hideReportedIllegal: true,
        illegalFeedbackHiddenCount: 2,
        actionFilter: 'PARK_ONLY',
        defaultSegmentActionFilter: 'ALL',
        actionFilterHiddenCount: 3,
      }),
    ).toBe(
      'No marked-space segments match "civic". Locally flagged illegal segments are hidden (2). Only park-legal segments are shown (3).',
    )

    expect(
      getAddressRecommendationEmptyMessage({
        activeSearchQuery: '',
        markedSpacesOnly: false,
        radiusMeters: 350,
        hideReportedIllegal: false,
        illegalFeedbackHiddenCount: 0,
        actionFilter: 'ALL',
        defaultSegmentActionFilter: 'ALL',
        actionFilterHiddenCount: 0,
      }),
    ).toBe('No ranked segments found within 350 m of this location.')
  })
})
