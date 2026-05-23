import { describe, expect, it } from 'vitest'
import {
  buildSavedPlanComparisonHighlights,
  buildSavedPlanComparisonRows,
} from './savedPlanComparison'
import type { SavedPlan } from './savedPlanTypes'

const makePlan = (overrides: Partial<SavedPlan>): SavedPlan => ({
  key: overrides.key ?? overrides.url ?? 'plan-key',
  title: overrides.title ?? 'Plan',
  url: overrides.url ?? 'https://example.com/plan',
  datasetId: overrides.datasetId ?? 'xinyi',
  addressLabel: overrides.addressLabel ?? '1 Civic Blvd',
  segmentName: overrides.segmentName ?? 'Section A',
  targetLabel: overrides.targetLabel ?? 'Space 1',
  createdAt: overrides.createdAt ?? '2026-03-20T12:00:00.000Z',
  ...overrides,
})

describe('saved plan comparison', () => {
  it('builds formatted rows with equality flags', () => {
    const left = makePlan({
      title: 'Left',
      parkingSpaceCount: 2,
      pinned: true,
      radiusMeters: 150,
      walkingDurationSeconds: 125,
      walkingEstimated: true,
    })
    const right = makePlan({
      title: 'Right',
      addressLabel: '2 Civic Blvd',
      parkingSpaceCount: 2,
      pinned: false,
      radiusMeters: 150,
      walkingDurationSeconds: 125,
      walkingEstimated: true,
    })

    const rows = buildSavedPlanComparisonRows(left, right)

    expect(rows.find((row) => row.label === 'Address')).toEqual({
      label: 'Address',
      left: '1 Civic Blvd',
      right: '2 Civic Blvd',
      same: false,
    })
    expect(rows.find((row) => row.label === 'Spaces')).toEqual({
      label: 'Spaces',
      left: '2',
      right: '2',
      same: true,
    })
    expect(rows.find((row) => row.label === 'Walk ETA')).toEqual({
      label: 'Walk ETA',
      left: '~2 min',
      right: '~2 min',
      same: true,
    })
  })

  it('builds walk, drive, and parking-quality highlights', () => {
    const left = makePlan({
      title: 'Alpha',
      allowedAction: 'TEMP_STOP',
      parkingSpaceCount: 1,
      tier: 'YELLOW',
      walkingDurationSeconds: 120,
      drivingDurationSeconds: 360,
      drivingEstimated: true,
    })
    const right = makePlan({
      title: 'Beta',
      allowedAction: 'PARK',
      parkingSpaceCount: 4,
      tier: 'GREEN',
      walkingDurationSeconds: 300,
      drivingDurationSeconds: 180,
      drivingEstimated: false,
    })

    const highlights = buildSavedPlanComparisonHighlights(left, right)

    expect(highlights).toHaveLength(3)
    expect(highlights[0]).toMatchObject({
      label: 'Walk ETA',
      winner: 'left',
    })
    expect(highlights[1]).toMatchObject({
      label: 'Drive ETA',
      winner: 'right',
    })
    expect(highlights[2]).toMatchObject({
      label: 'Parking quality',
      winner: 'right',
    })
    expect(highlights[2]?.summary).toContain('PARK • 4 spaces • GREEN')
  })
})
