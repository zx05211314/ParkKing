import { describe, expect, it } from 'vitest'
import {
  buildBestRecommendationSavedPlanSelection,
  buildListSegmentSavedPlanSelection,
  buildSavedPlanSelectionState,
} from './savedPlanSelectionSaveState'

describe('savedPlanSelectionSaveState', () => {
  it('builds saved-plan selection state with update messaging for an existing URL', () => {
    const result = buildSavedPlanSelectionState({
      actionFilter: 'PARK_ONLY',
      buildShareUrlForState: () => 'https://example.com/plan/seg-1',
      datasetId: 'xinyi',
      mode: 'NOW',
      radiusMeters: 500,
      recommendationRankMode: 'WALK',
      riskMode: 'NEUTRAL',
      savedPlans: [
        {
          key: 'saved-1',
          url: 'https://example.com/plan/seg-1',
          title: 'Existing plan',
          datasetId: 'xinyi',
          addressLabel: 'City Hall',
          segmentName: 'Civic Blvd',
          targetLabel: 'Marked space',
          createdAt: '2026-03-20T00:00:00.000Z',
          recommendationRankMode: 'WALK',
          routeProfile: 'walking',
          riskMode: 'NEUTRAL',
          mode: 'NOW',
          radiusMeters: 500,
          actionFilter: 'PARK_ONLY',
        },
      ],
      searchLocationLabel: 'City Hall',
      selectedRouteProfile: 'walking',
      selection: {
        selectedId: 'seg-1',
        title: 'Updated plan',
        segmentName: 'Civic Blvd',
        targetLabel: 'Marked space',
        walkingDurationSeconds: 90,
        walkingEstimated: false,
      },
    })

    expect(result?.url).toBe('https://example.com/plan/seg-1')
    expect(result?.existingPlan?.title).toBe('Existing plan')
    expect(result?.successMessage).toBe('Saved plan updated.')
    expect(result?.nextPlan.title).toBe('Updated plan')
    expect(result?.nextPlan.addressLabel).toBe('City Hall')
    expect(result?.nextPlan.walkingDurationSeconds).toBe(90)
  })

  it('returns null when a selection cannot produce a share URL', () => {
    const result = buildSavedPlanSelectionState({
      actionFilter: 'ALL',
      buildShareUrlForState: () => null,
      datasetId: null,
      mode: 'NOW',
      radiusMeters: 500,
      recommendationRankMode: 'WALK',
      riskMode: 'NEUTRAL',
      savedPlans: [],
      searchLocationLabel: null,
      selectedRouteProfile: 'walking',
      selection: {
        selectedId: 'seg-1',
        title: 'Plan',
        segmentName: null,
        targetLabel: null,
      },
    })

    expect(result).toBeNull()
  })

  it('maps list-segment and best-recommendation selections into saved-plan options', () => {
    const listSelection = buildListSegmentSavedPlanSelection({
      id: 'seg-1',
      name: 'Civic Blvd',
      curbMarking: 'WHITE_EDGE',
      confidence: 'HIGH',
      path: [
        [121.564, 25.033],
        [121.566, 25.033],
      ],
      tier: 'GREEN',
      allowedNow: 'PARK',
      reasonCodes: [],
      reasons: [],
      timeWindows: [],
      coverageConfidence: 'HIGH',
      overrideConfidence: 'HIGH',
      finalConfidence: 'HIGH',
      sourceReliability: 'HIGH',
      dataFreshnessDays: 1,
      recommendationRank: 2,
      quickActionTargetKey: 'space-1',
      quickActionTargetLabel: 'Marked space #1',
      recommendedWalkingDurationSeconds: 60,
      recommendedDrivingDurationSeconds: 30,
      recommendedWalkingEstimated: false,
      recommendedDrivingEstimated: true,
      parkingSpaceCount: 4,
    })
    const bestSelection = buildBestRecommendationSavedPlanSelection({
      bestAddressRecommendation: {
        id: 'seg-2',
        name: 'City Hall curb',
        allowedNow: 'PARK',
        parkingSpaceCount: 3,
        tier: 'GREEN',
      },
      bestAddressRecommendationTarget: {
        targetKey: 'space-2',
        targetLabel: 'Marked space #2',
      },
      bestAddressRecommendationRouteEta: {
        walkingDurationSeconds: 120,
        walkingEstimated: false,
        drivingDurationSeconds: 40,
        drivingEstimated: true,
      },
    })

    expect(listSelection.title).toBe('Civic Blvd (Option 2)')
    expect(listSelection.targetKey).toBe('space-1')
    expect(bestSelection?.title).toBe('City Hall curb (Best exact target)')
    expect(bestSelection?.drivingDurationSeconds).toBe(40)
  })
})
