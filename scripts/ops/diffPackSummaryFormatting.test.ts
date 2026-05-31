import { describe, expect, it } from 'vitest'
import { formatConsoleSummary, formatMarkdownSummary } from './diffPackSummaryFormatting'
import type { PackDiffReport } from './diffPackTypes'

const report: PackDiffReport = {
  schemaVersion: 1,
  generatedAt: '2026-03-21T00:00:00.000Z',
  prevPath: null,
  nextPath: 'C:/packs/next',
  firstPublish: true,
  districts: [
    {
      districtId: 'alpha',
      status: 'ADDED',
      severity: 'OK',
      issues: [
        {
          severity: 'WARN',
          code: 'DIFF_SIGN_OVERRIDE_UNMATCHED_INCREASE',
          message: 'signOverrideUnmatchedNamedCount increased for alpha',
          metric: {
            prev: 1,
            next: 3,
            increase: 2,
          },
        },
      ],
      meta: {
        segmentsCount: { prev: null, next: 10, delta: null, deltaPct: null },
        overridesAppliedCount: { prev: null, next: 0, delta: null, deltaPct: null },
        signOverridesCount: { prev: null, next: 0, delta: null, deltaPct: null },
        signOverrideMatchedSegmentCount: {
          prev: null,
          next: 0,
          delta: null,
          deltaPct: null,
        },
        signOverrideSpatialMatchCount: {
          prev: null,
          next: 1,
          delta: null,
          deltaPct: null,
        },
        signOverrideUnmatchedNamedCount: {
          prev: null,
          next: 0,
          delta: null,
          deltaPct: null,
        },
        curbMarkingKnownRate: { prev: null, next: 1, delta: null, deltaPct: null },
        restrictionTriggeredRate: { prev: null, next: 0, delta: null, deltaPct: null },
        boundaryBBox: {
          prev: null,
          next: null,
          delta: null,
          area: { prev: null, next: null, delta: null, deltaPct: null },
        },
        boundaryCenter: { prev: null, next: null, delta: null, distance: null },
        provenanceFetchedAt: { prev: null, next: null, changed: false },
      },
      files: {
        added: ['dataset_meta.json'],
        removed: [],
        modified: [],
      },
    },
  ],
  summary: {
    districtsAdded: ['alpha'],
    districtsRemoved: [],
    totalChangedFiles: 1,
  },
}

describe('diffPackSummaryFormatting', () => {
  it('formats console and markdown summaries', () => {
    expect(formatConsoleSummary(report)).toContain(
      'Diff summary: 1 added, 0 removed, 1 file changes',
    )
    expect(formatConsoleSummary(report)).toContain(
      'Named sign override mismatches increased: alpha (+2, 1 -> 3)',
    )
    expect(formatConsoleSummary(report)).toContain(
      'Sign override breakdown changed: alpha (total - -> 0; direct - -> 0; spatial - -> 1; unmatched - -> 0)',
    )
    expect(formatMarkdownSummary(report)).toContain('| alpha | ADDED | OK | 1 |')
    expect(formatMarkdownSummary(report)).toContain(
      '## Named sign override mismatch regressions',
    )
    expect(formatMarkdownSummary(report)).toContain('| alpha | 1 | 3 | +2 |')
    expect(formatMarkdownSummary(report)).toContain('## Sign override breakdown changes')
    expect(formatMarkdownSummary(report)).toContain(
      '| alpha | - -> 0 | - -> 0 | - -> 1 | - -> 0 |',
    )
  })
})
