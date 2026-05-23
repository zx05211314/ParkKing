import { describe, expect, it } from 'vitest'
import { parseIssueReportSummaryJsonArgs } from './issueReportSummaryJsonArgs'

describe('issueReportSummaryJsonArgs', () => {
  it('parses input validation flags', () => {
    expect(
      parseIssueReportSummaryJsonArgs([
        'node',
        'issueReportSummaryJson.ts',
        '--input',
        '.tmp/issue-summary.json',
        '--json',
      ]),
    ).toEqual({
      summaryPath: '.tmp/issue-summary.json',
      outPath: null,
      json: true,
    })
  })

  it('accepts summary as a compatibility alias', () => {
    expect(
      parseIssueReportSummaryJsonArgs([
        'node',
        'issueReportSummaryJson.ts',
        '--summary',
        '.tmp/issue-summary.json',
      ]),
    ).toEqual({
      summaryPath: '.tmp/issue-summary.json',
      outPath: null,
      json: false,
    })
  })

  it('accepts out for saved validation surfaces', () => {
    expect(
      parseIssueReportSummaryJsonArgs([
        'node',
        'issueReportSummaryJson.ts',
        '--input',
        '.tmp/issue-summary.json',
        '--out',
        '.tmp/index-surface.json',
      ]),
    ).toEqual({
      summaryPath: '.tmp/issue-summary.json',
      outPath: '.tmp/index-surface.json',
      json: false,
    })
  })

  it('rejects conflicting input aliases', () => {
    expect(() =>
      parseIssueReportSummaryJsonArgs([
        'node',
        'issueReportSummaryJson.ts',
        '--input',
        '.tmp/current.json',
        '--summary',
        '.tmp/legacy.json',
      ]),
    ).toThrow('--input conflicts with --summary')
  })

  it('requires an input path', () => {
    expect(() =>
      parseIssueReportSummaryJsonArgs(['node', 'issueReportSummaryJson.ts']),
    ).toThrow('input is required')
  })
})
