import { describe, expect, it, vi } from 'vitest'
import {
  applySavedPlanConflictState,
  clearSavedPlanConflictRecordUrls,
  clearSavedPlanConflictUrlList,
  mergeSavedPlanConflictDetailsByUrlValue,
  mergeSavedPlanConflictSharedPlansByUrlValue,
  mergeSavedPlanConflictUrlsValue,
} from './savedPlanConflictState'

describe('savedPlanConflictState', () => {
  it('does nothing when there are no conflicted urls', () => {
    const mergeSavedPlanConflictUrls = vi.fn()
    const mergeSavedPlanConflictDetails = vi.fn()
    const mergeSavedPlanConflictSharedPlans = vi.fn()

    applySavedPlanConflictState({
      conflictedUrls: [],
      conflictDetails: [],
      mergeSavedPlanConflictUrls,
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })

    expect(mergeSavedPlanConflictUrls).not.toHaveBeenCalled()
    expect(mergeSavedPlanConflictDetails).not.toHaveBeenCalled()
    expect(mergeSavedPlanConflictSharedPlans).not.toHaveBeenCalled()
  })

  it('applies saved-plan conflict urls, details, and shared plans together', () => {
    const mergeSavedPlanConflictUrls = vi.fn()
    const mergeSavedPlanConflictDetails = vi.fn()
    const mergeSavedPlanConflictSharedPlans = vi.fn()
    const conflictDetails = [
      {
        url: 'one',
        fields: [
          {
            label: 'Title',
            keptValue: 'Local',
            sharedValue: 'Remote',
          },
        ],
        sharedPlan: {
          key: 'plan-1',
          title: 'Remote',
          url: 'one',
          datasetId: 'xinyi',
          addressLabel: 'Addr',
          segmentName: 'Segment',
          targetLabel: null,
          createdAt: '2026-03-17T00:00:00.000Z',
        },
      },
    ]

    applySavedPlanConflictState({
      conflictedUrls: ['one'],
      conflictDetails,
      mergeSavedPlanConflictUrls,
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })

    expect(mergeSavedPlanConflictUrls).toHaveBeenCalledWith(['one'])
    expect(mergeSavedPlanConflictDetails).toHaveBeenCalledWith(conflictDetails)
    expect(mergeSavedPlanConflictSharedPlans).toHaveBeenCalledWith(conflictDetails)
  })

  it('merges conflict urls without duplicates', () => {
    expect(mergeSavedPlanConflictUrlsValue(['one'], ['one', 'two'])).toEqual([
      'one',
      'two',
    ])
  })

  it('merges conflict detail maps by url', () => {
    expect(
      mergeSavedPlanConflictDetailsByUrlValue(
        { keep: [{ label: 'A', keptValue: '1', sharedValue: '2' }] },
        [
          {
            url: 'one',
            fields: [{ label: 'Title', keptValue: 'Local', sharedValue: 'Remote' }],
            sharedPlan: {
              key: 'plan-1',
              title: 'Remote',
              url: 'one',
              datasetId: 'xinyi',
              addressLabel: 'Addr',
              segmentName: 'Segment',
              targetLabel: null,
              createdAt: '2026-03-17T00:00:00.000Z',
            },
          },
        ],
      ),
    ).toEqual({
      keep: [{ label: 'A', keptValue: '1', sharedValue: '2' }],
      one: [{ label: 'Title', keptValue: 'Local', sharedValue: 'Remote' }],
    })
  })

  it('merges shared conflict plans by url', () => {
    expect(
      mergeSavedPlanConflictSharedPlansByUrlValue(
        {
          keep: {
            key: 'keep',
            title: 'Keep',
            url: 'keep',
            datasetId: 'xinyi',
            addressLabel: null,
            segmentName: null,
            targetLabel: null,
            createdAt: '2026-03-17T00:00:00.000Z',
          },
        },
        [
          {
            url: 'one',
            fields: [{ label: 'Title', keptValue: 'Local', sharedValue: 'Remote' }],
            sharedPlan: {
              key: 'plan-1',
              title: 'Remote',
              url: 'one',
              datasetId: 'xinyi',
              addressLabel: 'Addr',
              segmentName: 'Segment',
              targetLabel: null,
              createdAt: '2026-03-17T00:00:00.000Z',
            },
          },
        ],
      ),
    ).toEqual({
      keep: {
        key: 'keep',
        title: 'Keep',
        url: 'keep',
        datasetId: 'xinyi',
        addressLabel: null,
        segmentName: null,
        targetLabel: null,
        createdAt: '2026-03-17T00:00:00.000Z',
      },
      one: {
        key: 'plan-1',
        title: 'Remote',
        url: 'one',
        datasetId: 'xinyi',
        addressLabel: 'Addr',
        segmentName: 'Segment',
        targetLabel: null,
        createdAt: '2026-03-17T00:00:00.000Z',
      },
    })
  })

  it('clears conflict records and url lists by url set', () => {
    expect(clearSavedPlanConflictRecordUrls({ one: 1, two: 2 }, ['one'])).toEqual({
      two: 2,
    })
    expect(clearSavedPlanConflictUrlList(['one', 'two'], ['one'])).toEqual(['two'])
  })
})
