import { describe, expect, it } from 'vitest'
import { dedupeSyncReports } from './syncServiceReportDedupe'

describe('syncServiceReportDedupe', () => {
  it('normalizes valid reports and removes duplicate report identities', () => {
    expect(
      dedupeSyncReports([
        {
          districtId: ' xinyi ',
          segmentId: ' seg-1 ',
          status: 'LEGAL',
          createdAt: ' 2025-01-01T00:00:00Z ',
          note: ' note ',
        },
        {
          districtId: 'xinyi',
          segmentId: 'seg-1',
          status: 'LEGAL',
          createdAt: '2025-01-01T00:00:00Z',
          note: 'note',
        },
        {
          districtId: 'daan',
          segmentId: 'seg-2',
          status: 'UNCLEAR',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ]),
    ).toEqual([
      {
        createdAt: '2025-01-02T00:00:00Z',
        districtId: 'daan',
        note: null,
        schemaVersion: 1,
        segmentId: 'seg-2',
        status: 'UNCLEAR',
      },
      {
        createdAt: '2025-01-01T00:00:00Z',
        districtId: 'xinyi',
        note: 'note',
        schemaVersion: 1,
        segmentId: 'seg-1',
        status: 'LEGAL',
      },
    ])
  })
})
