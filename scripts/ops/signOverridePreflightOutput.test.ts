import { describe, expect, it } from 'vitest'
import { formatSignOverridePreflight } from './signOverridePreflightOutput'

describe('formatSignOverridePreflight', () => {
  it('renders a readable markdown summary', () => {
    const output = formatSignOverridePreflight({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      configPath: 'configs/prod/xinyi.json',
      inputPath: 'data/overrides/xinyi.jsonl',
      inputExists: true,
      inputWarning: null,
      knownSegments: 4,
      rawReports: 5,
      validReports: 4,
      skippedInvalidReports: 1,
      skippedForeignDistrictReports: 1,
      effectiveOverrides: 2,
      duplicateSegmentsCollapsed: 1,
      matchedSegmentOverrides: 1,
      missingSegmentOverrides: 1,
      statusCounts: {
        LEGAL: 0,
        ILLEGAL: 1,
        UNCLEAR: 1,
      },
      missingSegmentIds: ['seg-missing'],
      duplicateSegmentIds: ['seg-1'],
      missingIssues: [],
      invalidReportIssues: [
        {
          reportNumber: 5,
          districtId: 'xinyi',
          segmentId: null,
          status: 'LEGAL',
          reasons: ['segmentId is required'],
        },
      ],
    })

    expect(output).toContain('# Sign Override Preflight: Xinyi (xinyi)')
    expect(output).toContain('- Input exists: yes')
    expect(output).toContain('- Effective overrides: 2')
    expect(output).toContain('## Invalid Reports')
    expect(output).toContain('report 5')
    expect(output).toContain('segmentId is required')
    expect(output).toContain('## Missing Segment Ids')
    expect(output).toContain('- seg-missing')
  })
})
