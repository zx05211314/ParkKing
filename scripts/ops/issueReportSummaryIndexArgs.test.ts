import { describe, expect, it } from 'vitest'
import { parseIssueReportSummaryIndexArgs } from './issueReportSummaryIndexArgs'

describe('issueReportSummaryIndexArgs', () => {
  it('parses input index flags', () => {
    expect(
      parseIssueReportSummaryIndexArgs([
        'node',
        'issueReportSummaryIndex.ts',
        '--input',
        '.tmp/issue-summary.json',
        '--out',
        '.tmp/issue-summary-index.json',
        '--index-base-url',
        'https://example.com/issue-index',
        '--json',
        '--top-count',
        '7',
      ]),
    ).toEqual({
      summaryPath: '.tmp/issue-summary.json',
      outPath: '.tmp/issue-summary-index.json',
      indexBaseUrl: 'https://example.com/issue-index',
      json: true,
      topCount: 7,
      writeIndex: false,
    })
  })

  it('accepts summary as a compatibility alias', () => {
    expect(
      parseIssueReportSummaryIndexArgs([
        'node',
        'issueReportSummaryIndex.ts',
        '--summary',
        '.tmp/issue-summary.json',
      ]),
    ).toEqual({
      summaryPath: '.tmp/issue-summary.json',
      outPath: null,
      indexBaseUrl: null,
      json: false,
      topCount: 5,
      writeIndex: false,
    })
  })

  it('rejects conflicting input aliases', () => {
    expect(() =>
      parseIssueReportSummaryIndexArgs([
        'node',
        'issueReportSummaryIndex.ts',
        '--input',
        '.tmp/current.json',
        '--summary',
        '.tmp/legacy.json',
      ]),
    ).toThrow('--input conflicts with --summary')
  })

  it('requires an input path', () => {
    expect(() =>
      parseIssueReportSummaryIndexArgs(['node', 'issueReportSummaryIndex.ts']),
    ).toThrow('input is required')
  })

  it('requires json output when using write-index', () => {
    expect(() =>
      parseIssueReportSummaryIndexArgs([
        'node',
        'issueReportSummaryIndex.ts',
        '--input',
        '.tmp/issue-summary.json',
        '--write-index',
      ]),
    ).toThrow('write index requires --json')
  })
})
