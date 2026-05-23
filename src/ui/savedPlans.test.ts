import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRIP_BOARD_FILTERS,
  addSavedPlan,
  applySavedPlanIntentSuggestions,
  buildSavedPlanComparisonHighlights,
  buildSavedPlanComparisonRows,
  filterSavedPlans,
  getSavedPlanConflictDetails,
  filterSavedPlanIntentSuggestionAssignments,
  getSavedPlanIntentSuggestionAssignments,
  getSavedPlanIntentSuggestion,
  getSavedPlanConflictUrls,
  getSavedPlanGroupStorageKey,
  getSavedPlanLeaderCandidates,
  getSavedPlanMetricLeaders,
  getTopSavedPlan,
  groupSavedPlansByIntent,
  groupSavedPlansByDataset,
  mergeSavedPlans,
  mergeSavedPlansWithConflicts,
  normalizeSavedPlanCollapsedGroups,
  SAVED_PLAN_INTENT_LABELS,
  normalizeTripBoardFilters,
  normalizeSavedPlans,
  removeSavedPlan,
  resolveSavedPlanConflictWithShared,
  resolveSavedPlanConflictsWithShared,
  selectSavedPlansForCompare,
  setSavedPlanIntentForUrls,
  sortSavedPlans,
  summarizeSavedPlanIntentSuggestionFilters,
  summarizeSavedPlanIntentSuggestions,
  summarizeSavedPlanIntents,
  summarizeSavedPlans,
  toggleSavedPlanCollapsedGroup,
  updateSavedPlan,
} from './savedPlans'

describe('savedPlans', () => {
  it('normalizes valid plans and removes duplicates by url', () => {
    expect(
      normalizeSavedPlans([
        {
          title: 'Taipei 101 target',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: 'Taipei 101',
          segmentName: 'City Hall Rd',
          targetLabel: 'A-17',
          createdAt: '2026-03-09T06:00:00.000Z',
          walkingDurationSeconds: 240,
          walkingEstimated: true,
          drivingDurationSeconds: 120,
          allowedAction: 'PARK',
          parkingSpaceCount: 4,
          tier: 'YELLOW',
        },
        {
          title: 'Duplicate',
          url: 'https://park.example.com/?segment=seg-1',
          createdAt: '2026-03-09T06:01:00.000Z',
        },
        {
          title: '',
          url: 'https://park.example.com/?segment=seg-2',
          createdAt: '2026-03-09T06:02:00.000Z',
        },
      ]),
    ).toEqual([
      {
        key: 'https://park.example.com/?segment=seg-1',
        title: 'Taipei 101 target',
        url: 'https://park.example.com/?segment=seg-1',
        datasetId: 'xinyi',
        addressLabel: 'Taipei 101',
        segmentName: 'City Hall Rd',
        targetLabel: 'A-17',
        createdAt: '2026-03-09T06:00:00.000Z',
        pinned: false,
        walkingDurationSeconds: 240,
        walkingEstimated: true,
        drivingDurationSeconds: 120,
        allowedAction: 'PARK',
        parkingSpaceCount: 4,
        tier: 'YELLOW',
      },
    ])
  })

  it('backfills saved-plan settings from the share URL when fields are missing', () => {
    expect(
      normalizeSavedPlans([
        {
          title: 'Share-derived plan',
          url: 'https://park.example.com/?segment=seg-1&rank=WALK&route=walking&risk=NEUTRAL&time=NOW&radius=650&action=PARK_ONLY',
          createdAt: '2026-03-09T06:00:00.000Z',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        title: 'Share-derived plan',
        recommendationRankMode: 'WALK',
        routeProfile: 'walking',
        riskMode: 'NEUTRAL',
        mode: 'NOW',
        radiusMeters: 650,
        actionFilter: 'PARK_ONLY',
      }),
    ])
  })

  it('adds plans most-recent first and refreshes an existing url', () => {
    const plans = addSavedPlan(
      [
        {
          key: 'https://park.example.com/?segment=seg-1',
          title: 'Older plan',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: 'Taipei 101',
          segmentName: 'City Hall Rd',
          targetLabel: 'A-17',
          createdAt: '2026-03-09T06:00:00.000Z',
        },
      ],
      {
        title: 'Updated plan',
        url: 'https://park.example.com/?segment=seg-1',
        datasetId: 'xinyi',
        addressLabel: 'Taipei 101',
        segmentName: 'City Hall Rd',
        targetLabel: 'A-18',
        createdAt: '2026-03-09T07:00:00.000Z',
      },
    )

    expect(plans).toEqual([
      expect.objectContaining({
        title: 'Updated plan',
        targetLabel: 'A-18',
        createdAt: '2026-03-09T07:00:00.000Z',
        pinned: false,
      }),
    ])
  })

  it('preserves the saved plan intent when an existing url is refreshed', () => {
    expect(
      addSavedPlan(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Commute plan',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T06:00:00.000Z',
            intent: 'COMMUTE',
          },
        ],
        {
          title: 'Commute plan refreshed',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: 'Taipei 101',
          segmentName: 'City Hall Rd',
          targetLabel: 'A-18',
          createdAt: '2026-03-09T07:00:00.000Z',
        },
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Commute plan refreshed',
        intent: 'COMMUTE',
      }),
    ])
  })

  it('removes saved plans by url', () => {
    expect(
      removeSavedPlan(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Plan 1',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
          },
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Plan 2',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:05:00.000Z',
          },
        ],
        'https://park.example.com/?segment=seg-1',
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Plan 2',
      }),
    ])
  })

  it('merges imported plans ahead of existing ones and keeps urls unique', () => {
    expect(
      mergeSavedPlans(
        [
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Imported plan',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: 'daan',
            addressLabel: 'Daan Forest Park',
            segmentName: 'Xinsheng S Rd',
            targetLabel: 'B-08',
            createdAt: '2026-03-09T08:00:00.000Z',
          },
        ],
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Existing plan',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T06:00:00.000Z',
          },
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Older duplicate',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: 'daan',
            addressLabel: 'Old import',
            segmentName: 'Renai Rd',
            targetLabel: 'B-01',
            createdAt: '2026-03-09T05:00:00.000Z',
          },
        ],
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Imported plan',
        url: 'https://park.example.com/?segment=seg-2',
        pinned: false,
      }),
      expect.objectContaining({
        title: 'Existing plan',
        url: 'https://park.example.com/?segment=seg-1',
        pinned: false,
      }),
    ])
  })

  it('detects saved-plan conflicts only when shared-edit fields differ', () => {
    const preferredPlan = {
      key: 'https://park.example.com/?segment=seg-1',
      title: 'Local title',
      url: 'https://park.example.com/?segment=seg-1',
      datasetId: 'xinyi',
      addressLabel: 'Taipei 101',
      segmentName: 'City Hall Rd',
      targetLabel: 'A-17',
      createdAt: '2026-03-09T06:00:00.000Z',
      pinned: true,
      intent: 'COMMUTE' as const,
    }

    expect(
      getSavedPlanConflictDetails(
        [preferredPlan],
        [
          {
            ...preferredPlan,
            title: 'Remote rename',
          },
        ],
      ),
    ).toEqual([
      {
        url: 'https://park.example.com/?segment=seg-1',
        fields: [
          {
            label: 'Title',
            keptValue: 'Local title',
            sharedValue: 'Remote rename',
          },
        ],
        sharedPlan: expect.objectContaining({
          title: 'Remote rename',
          url: 'https://park.example.com/?segment=seg-1',
        }),
      },
    ])

    expect(
      getSavedPlanConflictUrls(
        [preferredPlan],
        [
          {
            ...preferredPlan,
            createdAt: '2026-03-09T07:00:00.000Z',
          },
        ],
      ),
    ).toEqual([])
  })

  it('merges saved plans while reporting conflicted urls', () => {
    expect(
      mergeSavedPlansWithConflicts(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Local title',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T06:00:00.000Z',
            pinned: false,
          },
        ],
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Remote title',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T05:00:00.000Z',
            pinned: false,
          },
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Remote extra',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: 'daan',
            addressLabel: 'Daan Forest Park',
            segmentName: 'Xinsheng S Rd',
            targetLabel: 'B-08',
            createdAt: '2026-03-09T08:00:00.000Z',
            pinned: false,
          },
        ],
      ),
    ).toEqual({
      plans: [
        expect.objectContaining({
          title: 'Local title',
          url: 'https://park.example.com/?segment=seg-1',
        }),
        expect.objectContaining({
          title: 'Remote extra',
          url: 'https://park.example.com/?segment=seg-2',
        }),
      ],
      conflictedUrls: ['https://park.example.com/?segment=seg-1'],
      conflictDetails: [
        {
          url: 'https://park.example.com/?segment=seg-1',
          fields: [
            {
              label: 'Title',
              keptValue: 'Local title',
              sharedValue: 'Remote title',
            },
          ],
          sharedPlan: expect.objectContaining({
            title: 'Remote title',
            url: 'https://park.example.com/?segment=seg-1',
          }),
        },
      ],
    })
  })

  it('replaces a conflicted saved plan with the shared version', () => {
    expect(
      resolveSavedPlanConflictWithShared(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Local title',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            intent: 'COMMUTE',
          },
        ],
        {
          key: 'https://park.example.com/?segment=seg-1',
          title: 'Remote title',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T05:00:00.000Z',
          intent: 'BACKUP',
        },
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Remote title',
        datasetId: 'daan',
        intent: 'BACKUP',
      }),
    ])
  })

  it('replaces multiple conflicted saved plans with shared versions', () => {
    expect(
      resolveSavedPlanConflictsWithShared(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Local one',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
          },
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Local two',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:05:00.000Z',
          },
        ],
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Shared one',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'daan',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T05:00:00.000Z',
          },
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Shared two',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: 'zhongshan',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T05:05:00.000Z',
          },
        ],
      ),
    ).toEqual([
      expect.objectContaining({ title: 'Shared one', datasetId: 'daan' }),
      expect.objectContaining({ title: 'Shared two', datasetId: 'zhongshan' }),
    ])
  })

  it('updates the title for an existing saved plan', () => {
    expect(
      updateSavedPlan(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Plan 1',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
          },
        ],
        'https://park.example.com/?segment=seg-1',
        {
          title: 'Morning pickup',
        },
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Morning pickup',
        pinned: false,
      }),
    ])
  })

  it('preserves the pinned flag when a saved plan is refreshed', () => {
    expect(
      addSavedPlan(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Pinned plan',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T06:00:00.000Z',
            pinned: true,
          },
        ],
        {
          title: 'Pinned plan refreshed',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: 'Taipei 101',
          segmentName: 'City Hall Rd',
          targetLabel: 'A-18',
          createdAt: '2026-03-09T07:00:00.000Z',
        },
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Pinned plan refreshed',
        pinned: true,
      }),
    ])
  })

  it('filters saved plans by title, address, segment, target, dataset, and quality fields', () => {
    expect(
      filterSavedPlans(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Morning pickup',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T06:00:00.000Z',
            pinned: true,
            allowedAction: 'PARK',
            parkingSpaceCount: 4,
            tier: 'YELLOW',
          },
          {
            key: 'https://park.example.com/?segment=seg-2',
            title: 'Office backup',
            url: 'https://park.example.com/?segment=seg-2',
            datasetId: 'daan',
            addressLabel: 'Daan Forest Park',
            segmentName: 'Xinsheng S Rd',
            targetLabel: 'B-08',
            createdAt: '2026-03-09T07:00:00.000Z',
            pinned: false,
            intent: 'BACKUP',
          },
        ],
        'xinsheng',
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Office backup',
      }),
    ])
    expect(
      filterSavedPlans(
        [
          {
            key: 'https://park.example.com/?segment=seg-1',
            title: 'Morning pickup',
            url: 'https://park.example.com/?segment=seg-1',
            datasetId: 'xinyi',
            addressLabel: 'Taipei 101',
            segmentName: 'City Hall Rd',
            targetLabel: 'A-17',
            createdAt: '2026-03-09T06:00:00.000Z',
            pinned: true,
            allowedAction: 'PARK',
            parkingSpaceCount: 4,
            tier: 'YELLOW',
            intent: 'COMMUTE',
          },
        ],
        SAVED_PLAN_INTENT_LABELS.COMMUTE.toLowerCase(),
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Morning pickup',
      }),
    ])
  })

  it('filters saved plans by trip-board toggles', () => {
    expect(
      filterSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Parking target',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            allowedAction: 'PARK',
            parkingSpaceCount: 3,
            walkingDurationSeconds: 240,
          },
          {
            key: 'plan-b',
            title: 'Stop-only backup',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            allowedAction: 'TEMP_STOP',
            parkingSpaceCount: 0,
          },
        ],
        '',
        {
          pinnedOnly: false,
          parkOnly: true,
          markedSpacesOnly: true,
          etaReadyOnly: true,
        },
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Parking target',
      }),
    ])
  })

  it('filters saved plans by intent when the board intent filter is active', () => {
    expect(
      filterSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Commute target',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            intent: 'COMMUTE',
          },
          {
            key: 'plan-b',
            title: 'Pickup target',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            intent: 'PICKUP',
          },
        ],
        '',
        DEFAULT_TRIP_BOARD_FILTERS,
        'PICKUP',
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Pickup target',
      }),
    ])
  })

  it('filters saved plans to untagged entries when the board intent filter is untagged', () => {
    expect(
      filterSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Tagged target',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            intent: 'COMMUTE',
          },
          {
            key: 'plan-b',
            title: 'Needs tag',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
          },
        ],
        '',
        DEFAULT_TRIP_BOARD_FILTERS,
        'UNTAGGED',
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Needs tag',
      }),
    ])
  })

  it('filters untagged saved plans by suggestion review mode', () => {
    const plans = [
      {
        key: 'plan-suggested',
        title: 'School pickup lane',
        url: 'plan-suggested',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T07:00:00.000Z',
      },
      {
        key: 'plan-manual',
        title: 'City Hall curb',
        url: 'plan-manual',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T08:00:00.000Z',
      },
    ]

    expect(
      filterSavedPlans(
        plans,
        '',
        DEFAULT_TRIP_BOARD_FILTERS,
        'UNTAGGED',
        'SUGGESTED',
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'School pickup lane',
      }),
    ])

    expect(
      filterSavedPlans(
        plans,
        '',
        DEFAULT_TRIP_BOARD_FILTERS,
        'UNTAGGED',
        'MANUAL',
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'City Hall curb',
      }),
    ])
  })

  it('summarizes review counts for untagged saved plans', () => {
    expect(
      summarizeSavedPlanIntentSuggestionFilters([
        {
          key: 'plan-suggested',
          title: 'School pickup lane',
          url: 'plan-suggested',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
        },
        {
          key: 'plan-manual',
          title: 'City Hall curb',
          url: 'plan-manual',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T08:00:00.000Z',
        },
        {
          key: 'plan-tagged',
          title: 'Office backup option',
          url: 'plan-tagged',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T09:00:00.000Z',
          intent: 'BACKUP',
        },
      ]),
    ).toEqual({
      ALL: 2,
      SUGGESTED: 1,
      MANUAL: 1,
    })
  })

  it('retags multiple saved plans by visible urls and can clear intent again', () => {
    const retagged = setSavedPlanIntentForUrls(
      [
        {
          key: 'plan-a',
          title: 'Plan A',
          url: 'plan-a',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
        },
        {
          key: 'plan-b',
          title: 'Plan B',
          url: 'plan-b',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          intent: 'PICKUP',
        },
      ],
      ['plan-a', 'plan-b'],
      'BACKUP',
    )

    expect(retagged).toEqual([
      expect.objectContaining({ url: 'plan-a', intent: 'BACKUP' }),
      expect.objectContaining({ url: 'plan-b', intent: 'BACKUP' }),
    ])

    expect(setSavedPlanIntentForUrls(retagged, ['plan-b'], null)).toEqual([
      expect.objectContaining({ url: 'plan-a', intent: 'BACKUP' }),
      expect.not.objectContaining({ intent: 'BACKUP' }),
    ])
  })

  it('summarizes saved-plan intents and unassigned entries', () => {
    expect(
      summarizeSavedPlanIntents([
        {
          key: 'plan-a',
          title: 'Commute plan',
          url: 'plan-a',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
          intent: 'COMMUTE',
        },
        {
          key: 'plan-b',
          title: 'Pickup plan',
          url: 'plan-b',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          intent: 'PICKUP',
        },
        {
          key: 'plan-c',
          title: 'Untagged plan',
          url: 'plan-c',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T08:00:00.000Z',
        },
      ]),
    ).toEqual({
      COMMUTE: 1,
      PICKUP: 1,
      BACKUP: 0,
      taggedCount: 2,
      unassignedCount: 1,
    })
  })

  it('groups saved plans by intent in the canonical intent order', () => {
    expect(
      groupSavedPlansByIntent([
        {
          key: 'plan-a',
          title: 'Backup plan',
          url: 'plan-a',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
          intent: 'BACKUP',
        },
        {
          key: 'plan-b',
          title: 'Commute plan',
          url: 'plan-b',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          intent: 'COMMUTE',
        },
        {
          key: 'plan-c',
          title: 'Pickup plan',
          url: 'plan-c',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T08:00:00.000Z',
          intent: 'PICKUP',
        },
      ]).map((group) => ({
        intent: group.intent,
        count: group.count,
        leader: group.leader.title,
      })),
    ).toEqual([
      { intent: 'COMMUTE', count: 1, leader: 'Commute plan' },
      { intent: 'PICKUP', count: 1, leader: 'Pickup plan' },
      { intent: 'BACKUP', count: 1, leader: 'Backup plan' },
    ])
  })

  it('suggests commute, pickup, and backup intents from saved-plan text keywords', () => {
    expect(
      getSavedPlanIntentSuggestion({
        key: 'plan-home',
        title: 'Home commute target',
        url: 'plan-home',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T06:00:00.000Z',
      }),
    ).toEqual({
      intent: 'COMMUTE',
      reason: 'Matches commute keyword "commute".',
    })

    expect(
      getSavedPlanIntentSuggestion({
        key: 'plan-school',
        title: 'School pickup lane',
        url: 'plan-school',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T07:00:00.000Z',
      }),
    ).toEqual({
      intent: 'PICKUP',
      reason: 'Matches pickup keyword "pickup".',
    })

    expect(
      getSavedPlanIntentSuggestion({
        key: 'plan-backup',
        title: 'Office backup option',
        url: 'plan-backup',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T08:00:00.000Z',
      }),
    ).toEqual({
      intent: 'BACKUP',
      reason: 'Matches backup keyword "backup".',
    })
  })

  it('suggests pickup for stop-only untagged plans without stronger keywords', () => {
    expect(
      getSavedPlanIntentSuggestion({
        key: 'plan-stop',
        title: 'City Hall curb',
        url: 'plan-stop',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T09:00:00.000Z',
        allowedAction: 'TEMP_STOP',
      }),
    ).toEqual({
      intent: 'PICKUP',
      reason: 'Stop-only legality fits a pickup/drop-off use.',
    })
  })

  it('builds suggestion assignments and summarizes them by intent', () => {
    const assignments = getSavedPlanIntentSuggestionAssignments([
      {
        key: 'plan-home',
        title: 'Home commute target',
        url: 'plan-home',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T06:00:00.000Z',
      },
      {
        key: 'plan-school',
        title: 'School pickup lane',
        url: 'plan-school',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T07:00:00.000Z',
      },
      {
        key: 'plan-tagged',
        title: 'Already tagged',
        url: 'plan-tagged',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T08:00:00.000Z',
        intent: 'BACKUP',
      },
      {
        key: 'plan-plain',
        title: 'City Hall curb',
        url: 'plan-plain',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-09T09:00:00.000Z',
      },
    ])

    expect(assignments).toEqual([
      {
        url: 'plan-home',
        intent: 'COMMUTE',
        reason: 'Matches commute keyword "commute".',
      },
      {
        url: 'plan-school',
        intent: 'PICKUP',
        reason: 'Matches pickup keyword "pickup".',
      },
    ])

    expect(summarizeSavedPlanIntentSuggestions(assignments)).toEqual({
      totalCount: 2,
      COMMUTE: 1,
      PICKUP: 1,
      BACKUP: 0,
    })

    expect(filterSavedPlanIntentSuggestionAssignments(assignments, 'COMMUTE')).toEqual([
      {
        url: 'plan-home',
        intent: 'COMMUTE',
        reason: 'Matches commute keyword "commute".',
      },
    ])
  })

  it('applies only suggested intents when batch-tagging untagged plans', () => {
    expect(
      applySavedPlanIntentSuggestions(
        [
          {
            key: 'plan-home',
            title: 'Home commute target',
            url: 'plan-home',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
          },
          {
            key: 'plan-school',
            title: 'School pickup lane',
            url: 'plan-school',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
          },
          {
            key: 'plan-plain',
            title: 'City Hall curb',
            url: 'plan-plain',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T08:00:00.000Z',
          },
        ],
        ['plan-home', 'plan-school', 'plan-plain'],
      ),
    ).toEqual([
      expect.objectContaining({
        url: 'plan-home',
        intent: 'COMMUTE',
      }),
      expect.objectContaining({
        url: 'plan-school',
        intent: 'PICKUP',
      }),
      expect.objectContaining({
        url: 'plan-plain',
      }),
    ])
  })

  it('normalizes trip-board filters from unknown input', () => {
    expect(
      normalizeTripBoardFilters(
        {
          pinnedOnly: true,
          parkOnly: true,
          etaReadyOnly: true,
        },
        DEFAULT_TRIP_BOARD_FILTERS,
      ),
    ).toEqual({
      pinnedOnly: true,
      parkOnly: true,
      markedSpacesOnly: false,
      etaReadyOnly: true,
      conflictedOnly: false,
    })
  })

  it('filters saved plans to pinned entries only when requested', () => {
    expect(
      filterSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Pinned plan',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            pinned: true,
          },
          {
            key: 'plan-b',
            title: 'Regular plan',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            pinned: false,
          },
        ],
        '',
        {
          pinnedOnly: true,
          parkOnly: false,
          markedSpacesOnly: false,
          etaReadyOnly: false,
        },
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Pinned plan',
      }),
    ])
  })

  it('filters saved plans to conflicted entries only when requested', () => {
    expect(
      filterSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Conflicted plan',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            pinned: false,
          },
          {
            key: 'plan-b',
            title: 'Clean plan',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            pinned: false,
          },
        ],
        '',
        {
          pinnedOnly: false,
          parkOnly: false,
          markedSpacesOnly: false,
          etaReadyOnly: false,
          conflictedOnly: true,
        },
        'ALL',
        'ALL',
        ['plan-a'],
      ),
    ).toEqual([
      expect.objectContaining({
        title: 'Conflicted plan',
      }),
    ])
  })

  it('normalizes collapsed saved-plan groups from unknown input', () => {
    expect(
      normalizeSavedPlanCollapsedGroups(['xinyi', ' xinyi ', null, '', 'daan']),
    ).toEqual(['xinyi', 'daan'])
  })

  it('toggles collapsed saved-plan group keys with an unassigned fallback', () => {
    expect(toggleSavedPlanCollapsedGroup([], 'xinyi')).toEqual(['xinyi'])
    expect(toggleSavedPlanCollapsedGroup(['xinyi'], 'xinyi')).toEqual([])
    expect(toggleSavedPlanCollapsedGroup([], null)).toEqual([
      getSavedPlanGroupStorageKey(null),
    ])
  })

  it('groups saved plans by dataset while keeping grouped order', () => {
    expect(
      groupSavedPlansByDataset([
        {
          key: 'https://park.example.com/?segment=seg-1',
          title: 'Plan 1',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
          pinned: true,
        },
        {
          key: 'https://park.example.com/?segment=seg-2',
          title: 'Plan 2',
          url: 'https://park.example.com/?segment=seg-2',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          pinned: false,
        },
        {
          key: 'https://park.example.com/?segment=seg-3',
          title: 'Plan 3',
          url: 'https://park.example.com/?segment=seg-3',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T08:00:00.000Z',
          pinned: false,
        },
      ]),
    ).toEqual([
      {
        key: 'xinyi',
        plans: [
          expect.objectContaining({ title: 'Plan 1' }),
          expect.objectContaining({ title: 'Plan 3' }),
        ],
        count: 2,
        pinnedCount: 1,
      },
      {
        key: 'daan',
        plans: [expect.objectContaining({ title: 'Plan 2' })],
        count: 1,
        pinnedCount: 0,
      },
    ])
  })

  it('returns the first visible saved plan as the top board match', () => {
    expect(
      getTopSavedPlan([
        {
          key: 'https://park.example.com/?segment=seg-1',
          title: 'Plan 1',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
        },
        {
          key: 'https://park.example.com/?segment=seg-2',
          title: 'Plan 2',
          url: 'https://park.example.com/?segment=seg-2',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
        },
      ]),
    ).toEqual(expect.objectContaining({ title: 'Plan 1' }))
    expect(getTopSavedPlan([])).toBeNull()
  })

  it('fills compare slots from the visible board while preserving current visible selections', () => {
    expect(
      selectSavedPlansForCompare(
        [
          {
            key: 'plan-a',
            title: 'Plan A',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
          },
          {
            key: 'plan-b',
            title: 'Plan B',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
          },
          {
            key: 'plan-c',
            title: 'Plan C',
            url: 'plan-c',
            datasetId: 'daan',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T08:00:00.000Z',
          },
        ],
        ['plan-c'],
      ),
    ).toEqual(['plan-c', 'plan-a'])
  })

  it('falls back to the top visible saved plans when compare selections are missing', () => {
    expect(
      selectSavedPlansForCompare(
        [
          {
            key: 'plan-a',
            title: 'Plan A',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
          },
          {
            key: 'plan-b',
            title: 'Plan B',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
          },
        ],
        ['missing-plan'],
      ),
    ).toEqual(['plan-a', 'plan-b'])
  })

  it('builds metric leaders without pinned bias', () => {
    expect(
      getSavedPlanMetricLeaders([
        {
          key: 'plan-a',
          title: 'Pinned recent',
          url: 'plan-a',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T08:00:00.000Z',
          pinned: true,
          walkingDurationSeconds: 600,
          drivingDurationSeconds: 500,
          allowedAction: 'TEMP_STOP',
          parkingSpaceCount: 0,
          tier: 'RED',
        },
        {
          key: 'plan-b',
          title: 'Fast walk',
          url: 'plan-b',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          walkingDurationSeconds: 180,
          drivingDurationSeconds: 320,
          allowedAction: 'PARK',
          parkingSpaceCount: 2,
          tier: 'YELLOW',
        },
        {
          key: 'plan-c',
          title: 'Best quality',
          url: 'plan-c',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
          drivingDurationSeconds: 150,
          allowedAction: 'PARK',
          parkingSpaceCount: 5,
          tier: 'GREEN',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        key: 'WALK_ETA',
        label: 'Best walk',
        plan: expect.objectContaining({ title: 'Fast walk' }),
      }),
      expect.objectContaining({
        key: 'DRIVE_ETA',
        label: 'Best drive',
        plan: expect.objectContaining({ title: 'Best quality' }),
      }),
      expect.objectContaining({
        key: 'QUALITY',
        label: 'Best parking quality',
        plan: expect.objectContaining({ title: 'Best quality' }),
      }),
    ])
  })

  it('builds distinct leader candidates and falls back to visible order', () => {
    expect(
      getSavedPlanLeaderCandidates(
        [
          {
            key: 'plan-a',
            title: 'All-round leader',
            url: 'plan-a',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T08:00:00.000Z',
            walkingDurationSeconds: 180,
            drivingDurationSeconds: 160,
            allowedAction: 'PARK',
            parkingSpaceCount: 4,
            tier: 'GREEN',
          },
          {
            key: 'plan-b',
            title: 'Fallback option',
            url: 'plan-b',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            walkingDurationSeconds: 240,
            drivingDurationSeconds: 220,
            allowedAction: 'TEMP_STOP',
            parkingSpaceCount: 1,
            tier: 'YELLOW',
          },
        ],
        2,
      ),
    ).toEqual([
      expect.objectContaining({ title: 'All-round leader' }),
      expect.objectContaining({ title: 'Fallback option' }),
    ])
  })

  it('summarizes saved-plan readiness counts', () => {
    expect(
      summarizeSavedPlans([
        {
          key: 'plan-a',
          title: 'Plan A',
          url: 'plan-a',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
          pinned: true,
          allowedAction: 'PARK',
          parkingSpaceCount: 3,
          walkingDurationSeconds: 240,
        },
        {
          key: 'plan-b',
          title: 'Plan B',
          url: 'plan-b',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          allowedAction: 'TEMP_STOP',
          drivingDurationSeconds: 180,
        },
        {
          key: 'plan-c',
          title: 'Plan C',
          url: 'plan-c',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T08:00:00.000Z',
        },
      ]),
    ).toEqual({
      totalCount: 3,
      pinnedCount: 1,
      parkReadyCount: 1,
      etaReadyCount: 2,
      markedSpaceCount: 1,
    })
  })

  it('builds compare rows with same/different flags', () => {
    expect(
      buildSavedPlanComparisonRows(
        {
          key: 'https://park.example.com/?segment=seg-1',
          title: 'Plan 1',
          url: 'https://park.example.com/?segment=seg-1',
          datasetId: 'xinyi',
          addressLabel: 'Taipei 101',
          segmentName: 'City Hall Rd',
          targetLabel: 'A-17',
          createdAt: '2026-03-09T06:00:00.000Z',
          pinned: true,
          walkingDurationSeconds: 240,
          drivingDurationSeconds: 120,
          allowedAction: 'PARK',
          parkingSpaceCount: 4,
          tier: 'YELLOW',
        },
        {
          key: 'https://park.example.com/?segment=seg-2',
          title: 'Plan 2',
          url: 'https://park.example.com/?segment=seg-2',
          datasetId: 'daan',
          addressLabel: 'Taipei 101',
          segmentName: 'Xinsheng S Rd',
          targetLabel: 'B-08',
          createdAt: '2026-03-09T07:00:00.000Z',
          pinned: false,
          walkingDurationSeconds: 300,
          walkingEstimated: true,
          allowedAction: 'TEMP_STOP',
          parkingSpaceCount: 1,
          tier: 'RED',
        },
      ),
    ).toEqual([
      { label: 'District', left: 'xinyi', right: 'daan', same: false },
      { label: 'Address', left: 'Taipei 101', right: 'Taipei 101', same: true },
      { label: 'Segment', left: 'City Hall Rd', right: 'Xinsheng S Rd', same: false },
      { label: 'Target', left: 'A-17', right: 'B-08', same: false },
      { label: 'Intent', left: '-', right: '-', same: true },
      { label: 'Legality', left: 'PARK', right: 'TEMP_STOP', same: false },
      { label: 'Spaces', left: '4', right: '1', same: false },
      { label: 'Tier', left: 'YELLOW', right: 'RED', same: false },
      { label: 'Pinned', left: 'Yes', right: 'No', same: false },
      { label: 'Rank', left: '-', right: '-', same: true },
      { label: 'Route', left: '-', right: '-', same: true },
      { label: 'Risk', left: '-', right: '-', same: true },
      { label: 'Time', left: '-', right: '-', same: true },
      { label: 'Radius', left: '-', right: '-', same: true },
      { label: 'Action', left: '-', right: '-', same: true },
      { label: 'Walk ETA', left: '4 min', right: '~5 min', same: false },
      { label: 'Drive ETA', left: '2 min', right: '-', same: false },
    ])
  })

  it('builds comparison highlights for walk, drive, and parking quality', () => {
    expect(
      buildSavedPlanComparisonHighlights(
        {
          key: 'plan-a',
          title: 'Plan A',
          url: 'plan-a',
          datasetId: 'xinyi',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T06:00:00.000Z',
          walkingDurationSeconds: 240,
          drivingDurationSeconds: 180,
          allowedAction: 'PARK',
          parkingSpaceCount: 4,
          tier: 'YELLOW',
        },
        {
          key: 'plan-b',
          title: 'Plan B',
          url: 'plan-b',
          datasetId: 'daan',
          addressLabel: null,
          segmentName: null,
          targetLabel: null,
          createdAt: '2026-03-09T07:00:00.000Z',
          walkingDurationSeconds: 360,
          allowedAction: 'TEMP_STOP',
          parkingSpaceCount: 1,
          tier: 'RED',
        },
      ),
    ).toEqual([
      {
        label: 'Walk ETA',
        winner: 'left',
        summary: 'Plan A has the faster walk ETA (4 min vs 6 min).',
      },
      {
        label: 'Drive ETA',
        winner: 'left',
        summary: 'Plan A is the only compared plan with drive ETA ready.',
      },
      {
        label: 'Parking quality',
        winner: 'left',
        summary: 'Plan A has the stronger parking quality (PARK • 4 spaces • YELLOW vs STOP OK • 1 space • RED).',
      },
    ])
  })

  it('sorts saved plans by walk eta while keeping pinned plans first', () => {
    expect(
      sortSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Pinned slower',
            url: 'plan-a',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T08:00:00.000Z',
            pinned: true,
            walkingDurationSeconds: 600,
          },
          {
            key: 'plan-b',
            title: 'Fast walk',
            url: 'plan-b',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            pinned: false,
            walkingDurationSeconds: 180,
          },
          {
            key: 'plan-c',
            title: 'No eta',
            url: 'plan-c',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T09:00:00.000Z',
            pinned: false,
          },
        ],
        'WALK_ETA',
      ).map((plan) => plan.title),
    ).toEqual(['Pinned slower', 'Fast walk', 'No eta'])
  })

  it('sorts saved plans by parking quality snapshot', () => {
    expect(
      sortSavedPlans(
        [
          {
            key: 'plan-a',
            title: 'Stop only',
            url: 'plan-a',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T07:00:00.000Z',
            allowedAction: 'TEMP_STOP',
            parkingSpaceCount: 3,
            tier: 'YELLOW',
          },
          {
            key: 'plan-b',
            title: 'Marked parking',
            url: 'plan-b',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T06:00:00.000Z',
            allowedAction: 'PARK',
            parkingSpaceCount: 2,
            tier: 'YELLOW',
          },
          {
            key: 'plan-c',
            title: 'No stop',
            url: 'plan-c',
            datasetId: null,
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-09T09:00:00.000Z',
            allowedAction: 'NO_STOP',
            parkingSpaceCount: 8,
            tier: 'GREEN',
          },
        ],
        'QUALITY',
      ).map((plan) => plan.title),
    ).toEqual(['Marked parking', 'Stop only', 'No stop'])
  })
})
