import { describe, expect, it } from 'vitest'
import {
  buildIssueReportPublishGateHotspots,
  findDistrictIssueHotspot,
  formatDistrictIssueHotspotLabel,
} from './issueReportSummaryHotspots'

describe('issueReportSummaryHotspots', () => {
  it('finds the first hotspot for a district', () => {
    expect(
      findDistrictIssueHotspot(
        [
          {
            districtId: 'xinyi',
            segmentId: 'seg-1',
            segmentName: 'C2 curb',
          },
          {
            districtId: 'daan',
            segmentId: 'seg-2',
            segmentName: 'B1 curb',
          },
        ],
        'daan',
      ),
    ).toEqual({
      districtId: 'daan',
      segmentId: 'seg-2',
      segmentName: 'B1 curb',
    })
  })

  it('formats hotspot labels and handles missing hotspots', () => {
    expect(
      formatDistrictIssueHotspotLabel({
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: 'C2 curb',
      }),
    ).toBe('C2 curb (seg-1)')
    expect(
      formatDistrictIssueHotspotLabel({
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: null,
      }),
    ).toBe('seg-1')
    expect(formatDistrictIssueHotspotLabel(null)).toBe('-')
  })

  it('builds machine-readable publish gate hotspot mappings', () => {
    expect(
      buildIssueReportPublishGateHotspots(
        [
          {
            districtId: 'xinyi',
            segmentId: 'seg-1',
            segmentName: 'C2 curb',
          },
        ],
        {
          generatedAt: '2026-04-06T00:00:00.000Z',
          mode: 'strict',
          exitCode: 0,
          allowWarn: false,
          allowFail: true,
          overrideReason: null,
          totals: {
            info: 0,
            warn: 1,
            fail: 2,
          },
          topDistricts: [
            {
              districtId: 'xinyi',
              warn: 1,
              fail: 2,
              topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
              topFailCodes: ['HASH_MISMATCH'],
              signOverrideBreakdown: {
                matchedBySegmentId: 3,
                matchedBySpatial: 1,
                unmatchedNamed: 2,
              },
            },
          ],
          summaryPath: null,
          summaryUrl: null,
        },
      ),
    ).toEqual([
      {
        districtId: 'xinyi',
        warn: 1,
        fail: 2,
        topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
        topFailCodes: ['HASH_MISMATCH'],
        directOverrideMatches: 3,
        spatialOverrideMatches: 1,
        unmatchedNamedOverrides: 2,
        issueHotspotSegmentId: 'seg-1',
        issueHotspotSegmentName: 'C2 curb',
        issueHotspotSegmentLabel: 'C2 curb (seg-1)',
      },
    ])
  })
})
