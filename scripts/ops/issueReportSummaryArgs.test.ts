import { describe, expect, it } from 'vitest'
import { parseIssueReportSummaryArgs } from './issueReportSummaryArgs'

describe('issueReportSummaryArgs', () => {
  it('parses filters and normalizes since timestamps', () => {
    expect(
      parseIssueReportSummaryArgs([
        'node',
        'issueReportSummary.ts',
        '--publish-gate-summary',
        'public/data/generated/_ops/publish_gate_summary.json',
        '--scope',
        'alpha',
        '--district',
        'xinyi',
        '--segment',
        'seg-1',
        '--reason',
        'TIME_WINDOW',
        '--since',
        '2026-04-02T15:30:00+08:00',
        '--limit',
        '5',
        '--summary-base-url',
        'https://example.com/issue-summary/',
        '--raw-out',
        '.tmp/raw-issues.json',
        '--raw-base-url',
        'https://example.com/raw-issues/',
        '--csv-out',
        '.tmp/issue-csv',
        '--csv-root-url',
        'https://example.com/issue-csv/',
        '--packet-out',
        '.tmp/issue-packets',
        '--packet-root-url',
        'https://example.com/issue-packets/',
        '--packet-issue-limit',
        '3',
        '--json',
      ]),
    ).toEqual({
      syncStorePath: null,
      publishGateSummaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      reasonCode: 'TIME_WINDOW',
      since: '2026-04-02T07:30:00.000Z',
      limit: 5,
      outPath: null,
      summaryBaseUrl: 'https://example.com/issue-summary',
      rawOutPath: '.tmp/raw-issues.json',
      rawBaseUrl: 'https://example.com/raw-issues',
      csvOutPath: '.tmp/issue-csv',
      csvRootUrl: 'https://example.com/issue-csv',
      packetOutPath: '.tmp/issue-packets',
      packetRootUrl: 'https://example.com/issue-packets',
      packetIssueLimit: 3,
      json: true,
    })
  })

  it('uses defaults when optional flags are omitted', () => {
    expect(parseIssueReportSummaryArgs(['node', 'issueReportSummary.ts'])).toEqual({
      syncStorePath: null,
      publishGateSummaryPath: null,
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: 20,
      outPath: null,
      summaryBaseUrl: null,
      rawOutPath: null,
      rawBaseUrl: null,
      csvOutPath: null,
      csvRootUrl: null,
      packetOutPath: null,
      packetRootUrl: null,
      packetIssueLimit: 5,
      json: false,
    })
  })

  it('parses output paths for persisted summaries', () => {
    expect(
      parseIssueReportSummaryArgs([
        'node',
        'issueReportSummary.ts',
        '--out',
        '.tmp/issue-summary.md',
      ]),
    ).toEqual({
      syncStorePath: null,
      publishGateSummaryPath: null,
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: 20,
      outPath: '.tmp/issue-summary.md',
      summaryBaseUrl: null,
      rawOutPath: null,
      rawBaseUrl: null,
      csvOutPath: null,
      csvRootUrl: null,
      packetOutPath: null,
      packetRootUrl: null,
      packetIssueLimit: 5,
      json: false,
    })
  })

  it('accepts legacy base-url flags as compatibility aliases', () => {
    expect(
      parseIssueReportSummaryArgs([
        'node',
        'issueReportSummary.ts',
        '--csv-base-url',
        'https://example.com/legacy-csv/',
        '--packet-base-url',
        'https://example.com/legacy-packets/',
      ]),
    ).toEqual({
      syncStorePath: null,
      publishGateSummaryPath: null,
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: 20,
      outPath: null,
      summaryBaseUrl: null,
      rawOutPath: null,
      rawBaseUrl: null,
      csvOutPath: null,
      csvRootUrl: 'https://example.com/legacy-csv',
      packetOutPath: null,
      packetRootUrl: 'https://example.com/legacy-packets',
      packetIssueLimit: 5,
      json: false,
    })
  })

  it('rejects conflicting root-url and base-url aliases', () => {
    expect(() =>
      parseIssueReportSummaryArgs([
        'node',
        'issueReportSummary.ts',
        '--csv-root-url',
        'https://example.com/current-csv',
        '--csv-base-url',
        'https://example.com/legacy-csv',
      ]),
    ).toThrow('--csv-root-url conflicts with --csv-base-url')
  })

  it('throws for invalid limit values', () => {
    expect(() =>
      parseIssueReportSummaryArgs([
        'node',
        'issueReportSummary.ts',
        '--limit',
        '0',
      ]),
    ).toThrow('limit must be a positive integer')
  })

  it('throws for invalid packet issue limit values', () => {
    expect(() =>
      parseIssueReportSummaryArgs([
        'node',
        'issueReportSummary.ts',
        '--packet-issue-limit',
        '0',
      ]),
    ).toThrow('packet issue limit must be a positive integer')
  })
})
