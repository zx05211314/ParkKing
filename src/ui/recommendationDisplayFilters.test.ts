import { describe, expect, it } from 'vitest'
import { buildActiveFilterChips } from './recommendationDisplayFilters'

describe('buildActiveFilterChips', () => {
  it('returns only non-default filter chips', () => {
    const chips = buildActiveFilterChips({
      activeSearchQuery: 'civic',
      markedSpacesOnly: true,
      hideReportedIllegal: true,
      actionFilter: 'PARK_ONLY',
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
    })

    expect(chips).toEqual([
      { key: 'text', label: 'Text: civic' },
      { key: 'action', label: 'Action: Park ok' },
      { key: 'spaces', label: 'Spaces only' },
      { key: 'feedback', label: 'Hide illegal' },
      { key: 'inferred', label: 'Include inferred' },
      { key: 'radius', label: 'Radius 450 m' },
      { key: 'risk', label: 'Risk Conservative' },
    ])
  })
})
