import { describe, expect, it } from 'vitest'

import {
  buildBoundaryDiffAnomalies,
  sortBoundaryAnomalies,
} from './reportGateBoundaryDiffAnomalies'

describe('reportGateBoundaryDiffAnomalies', () => {
  it('filters boundary-related diff issues and sorts by severity then code', () => {
    const anomalies = buildBoundaryDiffAnomalies({
      districtId: 'xinyi',
      status: 'UPDATED',
      severity: 'FAIL',
      issues: [
        { severity: 'WARN', code: 'DIFF_CENTER_SHIFT', message: 'warn' },
        { severity: 'FAIL', code: 'DIFF_BBOX_COLLAPSE', message: 'fail' },
        { severity: 'WARN', code: 'DIFF_SEGMENTS_DELTA_PCT', message: 'ignore' },
      ],
      meta: {
        segmentsCount: { prev: null, next: null, delta: null, deltaPct: null },
        overridesAppliedCount: { prev: null, next: null, delta: null, deltaPct: null },
        signOverridesCount: { prev: null, next: null, delta: null, deltaPct: null },
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
      },
      files: { added: [], removed: [], modified: [] },
    })

    expect(anomalies.map((entry) => entry.code)).toEqual([
      'DIFF_CENTER_SHIFT',
      'DIFF_BBOX_COLLAPSE',
    ])

    expect(sortBoundaryAnomalies(anomalies).map((entry) => entry.code)).toEqual([
      'DIFF_BBOX_COLLAPSE',
      'DIFF_CENTER_SHIFT',
    ])
  })
})
