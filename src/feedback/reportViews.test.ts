import { describe, expect, it } from 'vitest'
import {
  compareReportStatusPriority,
  formatReportTimestamp,
  getLatestReports,
  getLatestReportsBySegment,
} from './reportViews'
import type { SegmentReport } from './reportTypes'

const baseReport = (
  overrides: Partial<SegmentReport>,
): SegmentReport => ({
  schemaVersion: 1,
  districtId: 'xinyi',
  segmentId: 'seg-1',
  status: 'LEGAL',
  note: null,
  createdAt: '2026-03-21T10:00:00.000Z',
  ...overrides,
})

describe('reportViews', () => {
  it('returns the latest reports by normalized segment id for one district', () => {
    const latest = getLatestReportsBySegment(
      [
        baseReport({ segmentId: 'seg-1-part-1', createdAt: '2026-03-21T09:00:00.000Z' }),
        baseReport({ segmentId: 'seg-1', status: 'ILLEGAL', createdAt: '2026-03-21T11:00:00.000Z' }),
        baseReport({ districtId: 'daan', segmentId: 'other' }),
      ],
      'xinyi',
    )

    expect(Object.keys(latest)).toEqual(['seg-1'])
    expect(latest['seg-1']).toMatchObject({
      segmentId: 'seg-1',
      status: 'ILLEGAL',
      createdAt: '2026-03-21T11:00:00.000Z',
    })
  })

  it('keeps only the newest report per district/segment pair', () => {
    const latest = getLatestReports([
      baseReport({ segmentId: 'seg-1-part-2', createdAt: '2026-03-21T09:00:00.000Z' }),
      baseReport({ segmentId: 'seg-1', status: 'UNCLEAR', createdAt: '2026-03-21T12:00:00.000Z' }),
      baseReport({ districtId: 'daan', segmentId: 'seg-1', status: 'ILLEGAL' }),
    ])

    expect(latest).toEqual([
      expect.objectContaining({
        districtId: 'daan',
        segmentId: 'seg-1',
      }),
      expect.objectContaining({
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'UNCLEAR',
      }),
    ])
  })

  it('formats timestamps and compares status priority', () => {
    expect(formatReportTimestamp(null)).toBe('Unknown')
    expect(formatReportTimestamp('not-a-date')).toBe('not-a-date')
    expect(compareReportStatusPriority('LEGAL', 'ILLEGAL')).toBeLessThan(0)
  })
})
