import { describe, expect, it } from 'vitest'
import { buildRecommendationDisplayState } from './recommendationDisplayStateResult'
import type { FavoriteAddress } from './recentAddresses'
import type { SegmentReport } from '../feedback/reports'

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

describe('buildRecommendationDisplayState', () => {
  it('builds the full recommendation display result', () => {
    const result = buildRecommendationDisplayState({
      filterQuery: ' civic ',
      markedSpacesOnly: true,
      hideReportedIllegal: true,
      illegalFeedbackHiddenCount: 2,
      actionFilter: 'PARK_ONLY',
      actionFilterHiddenCount: 1,
      includeInferred: true,
      radiusMeters: 450,
      riskMode: 'CONSERVATIVE',
      defaultSegmentActionFilter: 'ALL',
      defaultRadiusMeters: 300,
      defaultRiskMode: 'NEUTRAL',
      actionFilterLabels: {
        ALL: 'All',
        STOP_OK: 'Stop ok',
        PARK_ONLY: 'Park ok',
      },
      riskModeLabels: {
        CONSERVATIVE: 'Conservative',
        NEUTRAL: 'Neutral',
        AGGRESSIVE: 'Aggressive',
      },
      favoriteAddresses: [favoriteAddress],
      searchAnchor: { result: favoriteAddress },
      addressRecommendationTargets: [
        {
          rank: 1,
          segment: {
            id: 'seg-a',
            path: [
              [121.565, 25.033],
              [121.5653, 25.0332],
            ],
            distanceMeters: 120,
            allowedNow: 'PARK',
            tier: 'GREEN',
            sourceType: 'CURB',
            parkingSpaceCount: 2,
            reasonCodes: ['PARKING_SPACE_EVIDENCE'],
          },
          targetKey: 'space-a',
          targetIndex: 0,
          targetKind: 'PARKING_SPACE',
          targetLabel: 'Space A',
          targetMetadata: [],
          destination: [121.565, 25.033],
          description: null,
          hint: 'Best exact target',
          walkDistanceMeters: 100,
        },
        {
          rank: 2,
          segment: {
            id: 'seg-b',
            path: [
              [121.566, 25.034],
              [121.5662, 25.0341],
            ],
            distanceMeters: 240,
            allowedNow: 'TEMP_STOP',
            parkingSpaceCount: 0,
          },
          targetKey: null,
          targetIndex: 1,
          targetKind: 'SEGMENT',
          targetLabel: 'Segment B',
          targetMetadata: [],
          destination: [121.566, 25.034],
          description: null,
          hint: null,
          walkDistanceMeters: 240,
        },
      ],
      reportsBySegment: { 'seg-a': report },
      routeEtaBySegmentId: {
        'seg-a': {
          walkingDistanceMeters: 100,
          walkingDurationSeconds: 90,
          walkingEstimated: false,
          drivingDistanceMeters: 200,
          drivingDurationSeconds: 60,
          drivingEstimated: false,
        },
      },
      recommendationRankMode: 'WALK',
      routeEtaStatus: 'loading',
      routeEtaError: null,
      searchLocation: [121.565, 25.033],
      searchLocationLabel: '1 Civic Blvd',
      displaySegments: [
        { id: 'seg-a', allowedNow: 'PARK', parkingSpaceCount: 2 },
        { id: 'seg-b', allowedNow: 'TEMP_STOP', parkingSpaceCount: 0 },
      ],
    })

    expect(result.activeSearchQuery).toBe('civic')
    expect(result.hasActiveFilters).toBe(true)
    expect(result.recommendedSegmentIds).toEqual(['seg-a', 'seg-b'])
    expect(result.bestAddressRecommendation?.id).toBe('seg-a')
    expect(result.alternativeAddressRecommendations).toHaveLength(1)
    expect(result.addressRecommendationRankingLabel).toContain('walk ETA')
    expect(result.addressRecommendationFeedbackLabel).toContain(
      'Local feedback is adjusting 1 nearby option',
    )
    expect(result.listSortSummary).toContain('Live ETA is still loading')
    expect(result.nearbySnapshot).toEqual({
      total: 2,
      parkCount: 1,
      stopCount: 1,
      noStopCount: 0,
      markedSpaceCount: 1,
      etaReadyCount: 1,
    })
    expect(result.isPinnedFavorite).toBe(true)
    expect(result.pinnedFavoriteRole).toBe('HOME')
    expect(result.bestAddressRecommendationReason).toBe(
      'High-confidence parking backed by mapped official marked spaces',
    )
    expect(result.bestAddressRecommendationReport).toEqual(report)
    expect(result.bestAddressRecommendationFeedback).toContain(
      'Locally verified legal',
    )
    expect(result.emptySegmentsMessage).toContain('No marked-space segments match "civic".')
    expect(result.addressRecommendationEmptyMessage).toContain(
      'No marked-space candidates match "civic".',
    )
  })

  it('surfaces distance-fallback text when live ETA routing is unavailable', () => {
    const result = buildRecommendationDisplayState({
      filterQuery: '',
      markedSpacesOnly: false,
      hideReportedIllegal: false,
      illegalFeedbackHiddenCount: 0,
      actionFilter: 'ALL',
      actionFilterHiddenCount: 0,
      includeInferred: true,
      radiusMeters: 450,
      riskMode: 'NEUTRAL',
      defaultSegmentActionFilter: 'ALL',
      defaultRadiusMeters: 300,
      defaultRiskMode: 'NEUTRAL',
      actionFilterLabels: {
        ALL: 'All',
        STOP_OK: 'Stop ok',
        PARK_ONLY: 'Park ok',
      },
      riskModeLabels: {
        CONSERVATIVE: 'Conservative',
        NEUTRAL: 'Neutral',
        AGGRESSIVE: 'Aggressive',
      },
      favoriteAddresses: [],
      searchAnchor: null,
      addressRecommendationTargets: [],
      reportsBySegment: {},
      routeEtaBySegmentId: {},
      recommendationRankMode: 'WALK',
      routeEtaStatus: 'ready',
      routeEtaError:
        'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
      searchLocation: [121.565, 25.033],
      searchLocationLabel: '1 Civic Blvd',
      displaySegments: [],
    })

    expect(result.addressRecommendationRankingLabel).toBe(
      'Live walk ETA unavailable on this deployment. Ranking falls back to target distance with marked-space support',
    )
    expect(result.listSortSummary).toBe(
      'List sorted by target distance while live walk ETA is unavailable on this deployment.',
    )
  })
})
