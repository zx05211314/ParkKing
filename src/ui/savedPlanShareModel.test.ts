import { describe, expect, it } from 'vitest'
import {
  buildSavedPlanCurrentTitle,
  buildSavedPlanEntry,
  buildSavedPlanRouteEtaFields,
} from './savedPlanShareModel'

describe('savedPlanShareModel', () => {
  it('builds route eta fields only for defined values', () => {
    expect(
      buildSavedPlanRouteEtaFields({
        walkingDurationSeconds: 120,
        walkingEstimated: true,
        drivingDurationSeconds: null,
      }),
    ).toEqual({
      walkingDurationSeconds: 120,
      walkingEstimated: true,
    })
  })

  it('builds a saved-plan entry with optional fields', () => {
    expect(
      buildSavedPlanEntry({
        title: 'Plan',
        url: 'https://example.com',
        datasetId: 'xinyi',
        addressLabel: 'Addr',
        segmentName: 'Segment',
        targetLabel: 'Target',
        recommendationRankMode: 'WALK',
        routeProfile: 'walking',
        riskMode: 'NEUTRAL',
        mode: 'NOW',
        radiusMeters: 250,
        actionFilter: 'ALL',
        routeEta: {
          walkingDurationSeconds: 120,
          drivingDurationSeconds: null,
          walkingEstimated: false,
        },
        allowedAction: 'PARK',
        parkingSpaceCount: 4,
        tier: 'GREEN',
        createdAt: '2026-03-18T00:00:00.000Z',
      }),
    ).toEqual({
      title: 'Plan',
      url: 'https://example.com',
      datasetId: 'xinyi',
      addressLabel: 'Addr',
      segmentName: 'Segment',
      targetLabel: 'Target',
      createdAt: '2026-03-18T00:00:00.000Z',
      recommendationRankMode: 'WALK',
      routeProfile: 'walking',
      riskMode: 'NEUTRAL',
      mode: 'NOW',
      radiusMeters: 250,
      actionFilter: 'ALL',
      walkingDurationSeconds: 120,
      walkingEstimated: false,
      allowedAction: 'PARK',
      parkingSpaceCount: 4,
      tier: 'GREEN',
    })
  })

  it('builds the current saved-plan title in priority order', () => {
    expect(buildSavedPlanCurrentTitle('Segment', 'Addr', '  query  ')).toBe('Segment')
    expect(buildSavedPlanCurrentTitle(null, 'Addr', '  query  ')).toBe('Addr')
    expect(buildSavedPlanCurrentTitle(null, null, '  query  ')).toBe('Filtered: query')
    expect(buildSavedPlanCurrentTitle(null, null, '   ')).toBe('Saved parking view')
  })
})
