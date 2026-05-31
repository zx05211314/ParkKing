import { describe, expect, it } from 'vitest'
import { buildPublishGateDiffReportWarnings } from './publishGateDiffWarningState'
import type { PackDiffReport } from './diffPackTypes'
import type { DistrictMetaDiff } from './diffPackMetrics'

const emptyMetaDiff: DistrictMetaDiff = {
  segmentsCount: { prev: null, next: null, delta: null, deltaPct: null },
  overridesAppliedCount: { prev: null, next: null, delta: null, deltaPct: null },
  signOverridesCount: { prev: null, next: null, delta: null, deltaPct: null },
  signOverrideUnmatchedNamedCount: { prev: null, next: null, delta: null, deltaPct: null },
  curbMarkingKnownRate: { prev: null, next: null, delta: null, deltaPct: null },
  restrictionTriggeredRate: { prev: null, next: null, delta: null, deltaPct: null },
  boundaryBBox: {
    prev: null,
    next: null,
    delta: null,
    area: { prev: null, next: null, delta: null, deltaPct: null },
  },
  boundaryCenter: { prev: null, next: null, delta: null, distance: null },
  provenanceFetchedAt: { prev: null, next: null, changed: false },
}

const baseReport: PackDiffReport = {
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  prevPath: null,
  nextPath: '/dataset/xinyi',
  firstPublish: false,
  summary: {
    districtsAdded: [],
    districtsRemoved: [],
    totalChangedFiles: 1,
  },
  districts: [
    {
      districtId: 'xinyi',
      status: 'UPDATED',
      severity: 'WARN',
      issues: [
        {
          severity: 'WARN',
          code: 'DIFF_SEGMENT_COUNT_DELTA',
          message: 'segment count changed',
        },
      ],
      meta: emptyMetaDiff,
      files: { added: [], removed: [], modified: [] },
    },
  ],
}

describe('publishGateDiffWarningState', () => {
  it('escalates diff warnings when strict diff is enabled', () => {
    expect(
      buildPublishGateDiffReportWarnings({
        districtId: 'xinyi',
        diffReport: baseReport,
        strictDiff: true,
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'DIFF_SEGMENT_COUNT_DELTA',
        severity: 'FAIL',
      }),
    ])
  })

  it('returns schema warning when diff schema version is unknown', () => {
    expect(
      buildPublishGateDiffReportWarnings({
        districtId: 'xinyi',
        diffReport: { ...baseReport, schemaVersion: 99 },
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'DIFF_SCHEMA_UNKNOWN',
        severity: 'WARN',
      }),
    ])
  })
})
