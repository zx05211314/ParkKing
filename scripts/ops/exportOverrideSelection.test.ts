import { describe, expect, it } from 'vitest'

import {
  groupReportsByDistrict,
  isReportNewer,
  selectLatestReports,
  sortDistrictReports,
} from './exportOverrideSelection'
import type { SegmentReport } from './exportOverrideTypes'

const makeReport = (overrides: Partial<SegmentReport>): SegmentReport => ({
  districtId: 'xinyi',
  segmentId: 'seg-1',
  status: 'LEGAL',
  createdAt: '2026-02-01T00:00:00Z',
  schemaVersion: 1,
  ...overrides,
})

describe('exportOverrideSelection', () => {
  it('prefers newer timestamps before other fields', () => {
    const current = makeReport({ createdAt: '2026-02-01T00:00:00Z', status: 'ILLEGAL' })
    const next = makeReport({ createdAt: '2026-02-02T00:00:00Z', status: 'LEGAL' })

    expect(isReportNewer(next, current)).toBe(true)
    expect(isReportNewer(current, next)).toBe(false)
  })

  it('selects one latest report per district and segment', () => {
    const latest = selectLatestReports([
      makeReport({ districtId: 'xinyi', segmentId: 'seg-2', createdAt: '2026-02-01T00:00:00Z' }),
      makeReport({ districtId: 'xinyi', segmentId: 'seg-2', createdAt: '2026-02-03T00:00:00Z' }),
      makeReport({ districtId: 'daan', segmentId: 'seg-2', createdAt: '2026-02-02T00:00:00Z' }),
    ])

    expect(latest).toHaveLength(2)
    expect(latest.find((report) => report.districtId === 'xinyi')?.createdAt).toBe(
      '2026-02-03T00:00:00Z',
    )
  })

  it('groups districts alphabetically and sorts per-district outputs deterministically', () => {
    const groups = groupReportsByDistrict([
      makeReport({ districtId: 'xinyi', segmentId: 'seg-2' }),
      makeReport({ districtId: 'daan', segmentId: 'seg-9' }),
    ])

    expect(groups.map(([districtId]) => districtId)).toEqual(['daan', 'xinyi'])

    const sorted = sortDistrictReports([
      makeReport({ segmentId: 'seg-2', createdAt: '2026-02-03T00:00:00Z' }),
      makeReport({ segmentId: 'seg-1', createdAt: '2026-02-01T00:00:00Z', note: 'b' }),
      makeReport({ segmentId: 'seg-1', createdAt: '2026-02-01T00:00:00Z', note: 'a' }),
    ])

    expect(sorted.map((report) => `${report.segmentId}:${report.note ?? ''}`)).toEqual([
      'seg-1:a',
      'seg-1:b',
      'seg-2:',
    ])
  })
})
