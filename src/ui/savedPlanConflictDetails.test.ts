import { describe, expect, it } from 'vitest'
import {
  formatSavedPlanConflictValue,
  getSavedPlanConflictDetails,
  getSavedPlanConflictUrls,
} from './savedPlanConflictDetails'
import type { SavedPlan } from './savedPlanTypes'

const buildPlan = (overrides: Partial<SavedPlan> = {}): SavedPlan => ({
  key: overrides.url ?? 'one',
  title: 'Local plan',
  url: overrides.url ?? 'one',
  datasetId: 'xinyi',
  addressLabel: null,
  segmentName: null,
  targetLabel: null,
  createdAt: '2026-03-21T00:00:00.000Z',
  ...overrides,
})

describe('savedPlanConflictDetails', () => {
  it('formats conflict values for typed fields', () => {
    expect(formatSavedPlanConflictValue('intent', 'COMMUTE')).toBe('Commute')
    expect(formatSavedPlanConflictValue('radiusMeters', 250)).toBe('250 m')
    expect(formatSavedPlanConflictValue('parkingSpaceCount', 2)).toBe('2 spaces')
    expect(formatSavedPlanConflictValue('allowedAction', 'TEMP_STOP')).toBe('Stop ok')
  })

  it('builds conflict details and urls for differing saved plans', () => {
    const local = buildPlan({
      url: 'one',
      title: 'Local plan',
      intent: 'COMMUTE',
      routeProfile: 'walking',
      radiusMeters: 250,
    })
    const shared = buildPlan({
      url: 'one',
      title: 'Shared plan',
      intent: 'BACKUP',
      routeProfile: 'driving',
      radiusMeters: 400,
    })

    expect(getSavedPlanConflictUrls([local], [shared])).toEqual(['one'])
    expect(getSavedPlanConflictDetails([local], [shared])).toEqual([
      {
        url: 'one',
        sharedPlan: shared,
        fields: [
          {
            label: 'Title',
            keptValue: 'Local plan',
            sharedValue: 'Shared plan',
          },
          {
            label: 'Intent',
            keptValue: 'Commute',
            sharedValue: 'Backup',
          },
          {
            label: 'Route',
            keptValue: 'Walking',
            sharedValue: 'Driving',
          },
          {
            label: 'Radius',
            keptValue: '250 m',
            sharedValue: '400 m',
          },
        ],
      },
    ])
  })
})
