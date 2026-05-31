import { describe, expect, it } from 'vitest'
import { filterSavedPlansValue } from './savedPlanFilters'
import { DEFAULT_TRIP_BOARD_FILTERS, type SavedPlan } from './savedPlanTypes'

const suggestedPlan: SavedPlan = {
  key: 'plan-suggested',
  title: 'School pickup lane',
  url: 'plan-suggested',
  datasetId: 'xinyi',
  addressLabel: null,
  segmentName: null,
  targetLabel: null,
  createdAt: '2026-03-09T07:00:00.000Z',
}

const manualPlan: SavedPlan = {
  key: 'plan-manual',
  title: 'City Hall curb',
  url: 'plan-manual',
  datasetId: 'xinyi',
  addressLabel: null,
  segmentName: null,
  targetLabel: null,
  createdAt: '2026-03-09T08:00:00.000Z',
  allowedAction: 'PARK',
}

describe('savedPlanFilters', () => {
  it('filters untagged plans by suggestion review mode', () => {
    expect(
      filterSavedPlansValue(
        [suggestedPlan, manualPlan],
        '',
        DEFAULT_TRIP_BOARD_FILTERS,
        'UNTAGGED',
        'SUGGESTED',
        [],
      ),
    ).toEqual([expect.objectContaining({ url: 'plan-suggested' })])

    expect(
      filterSavedPlansValue(
        [suggestedPlan, manualPlan],
        '',
        DEFAULT_TRIP_BOARD_FILTERS,
        'UNTAGGED',
        'MANUAL',
        [],
      ),
    ).toEqual([expect.objectContaining({ url: 'plan-manual' })])
  })

  it('filters conflicted and query-matched plans together', () => {
    expect(
      filterSavedPlansValue(
        [
          suggestedPlan,
          {
            ...manualPlan,
            title: 'Pinned office backup',
            pinned: true,
          },
        ],
        'backup',
        {
          ...DEFAULT_TRIP_BOARD_FILTERS,
          pinnedOnly: true,
          conflictedOnly: true,
        },
        'ALL',
        'ALL',
        ['plan-manual'],
      ),
    ).toEqual([
      expect.objectContaining({
        url: 'plan-manual',
        title: 'Pinned office backup',
      }),
    ])
  })
})
