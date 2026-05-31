import { describe, expect, it } from 'vitest'

import { buildMetricsHistoryEntry } from './writeMetricsHistoryEntry'

describe('writeMetricsHistoryEntry', () => {
  it('builds metrics from direct fields and nested counts', () => {
    const entry = buildMetricsHistoryEntry(
      {
        districtId: 'xinyi',
        publishedAt: '2026-02-01T00:00:00Z',
        counts: {
          segments: '12',
          overridesApplied: 3,
          signOverrides: '4',
          signOverrideUnmatchedNamedCount: '2',
        },
        curbMarkingKnownRate: '0.5',
        restrictionTriggeredRate: 0.2,
        provenanceFetchedAt: '2026-01-31T22:00:00Z',
      },
      'pack-1',
    )

    expect(entry.packId).toBe('pack-1')
    expect(entry.districtId).toBe('xinyi')
    expect(entry.segmentsCount).toBe(12)
    expect(entry.overridesAppliedCount).toBe(3)
    expect(entry.signOverridesCount).toBe(4)
    expect(entry.signOverrideUnmatchedNamedCount).toBe(2)
    expect(entry.curbMarkingKnownRate).toBe(0.5)
    expect(entry.restrictionTriggeredRate).toBe(0.2)
    expect(entry.provenanceFetchedAt).toBe('2026-01-31T22:00:00Z')
  })

  it('falls back to defaults when fields are missing or invalid', () => {
    const entry = buildMetricsHistoryEntry({}, 'pack-2')

    expect(entry.packId).toBe('pack-2')
    expect(entry.districtId).toBe('unknown')
    expect(entry.segmentsCount).toBe(0)
    expect(entry.overridesAppliedCount).toBe(0)
    expect(entry.signOverridesCount).toBe(0)
    expect(entry.signOverrideUnmatchedNamedCount).toBe(0)
    expect(entry.curbMarkingKnownRate).toBe(0)
    expect(entry.restrictionTriggeredRate).toBe(0)
    expect(entry.provenanceFetchedAt).toBeNull()
  })
})
