import { describe, expect, it } from 'vitest'
import {
  buildDistrictDiffIssues,
  resolveDistrictDiffSeverity,
} from './diffPackDistrictIssues'

describe('buildDistrictDiffIssues', () => {
  it('builds fail and warn issues and sorts by severity then code', () => {
    const issues = buildDistrictDiffIssues({
      districtId: 'beta',
      segmentsCount: { prev: 10, next: 0, delta: -10, deltaPct: -1 },
      overridesAppliedCount: { prev: 0, next: 5, delta: 5, deltaPct: null },
      signOverrideUnmatchedNamedCount: { prev: 0, next: 2, delta: 2, deltaPct: null },
      curbMarkingKnownRate: { prev: 0.95, next: 0.7, delta: -0.25, deltaPct: -0.263 },
      restrictionTriggeredRate: { prev: 0.2, next: 0.1, delta: -0.1, deltaPct: -0.5 },
      boundaryBBox: {
        prev: [0, 0, 1, 1],
        next: [0, 0, 0, 0],
        changed: true,
        area: { prev: 1, next: 0, delta: -1, deltaPct: -1 },
      },
    })

    expect(issues.map((issue) => issue.code)).toEqual([
      'DIFF_BBOX_COLLAPSE',
      'DIFF_SEGMENTS_ZERO',
      'DIFF_CURB_MARKING_DROP',
      'DIFF_RESTRICTION_DROP',
      'DIFF_SEGMENTS_DELTA_PCT',
      'DIFF_SIGN_OVERRIDE_UNMATCHED_INCREASE',
    ])
    expect(resolveDistrictDiffSeverity(issues)).toBe('FAIL')
  })

  it('returns ok severity when there are no issues', () => {
    expect(resolveDistrictDiffSeverity([])).toBe('OK')
  })
})
