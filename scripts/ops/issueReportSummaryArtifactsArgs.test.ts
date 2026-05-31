import { describe, expect, it } from 'vitest'
import { parseIssueReportSummaryArtifactsArgs } from './issueReportSummaryArtifactsArgs'

describe('issueReportSummaryArtifactsArgs', () => {
  it('parses summary artifact builder args', () => {
    expect(
      parseIssueReportSummaryArtifactsArgs([
        'tsx',
        'scripts/ops/issueReportSummaryArtifacts.ts',
        '--input',
        '.tmp/issue-summary.json',
        '--label',
        'Manual',
        '--input-url',
        'https://example.com/manual-input',
        '--publish-gate-summary-url',
        'https://example.com/publish-gate-summary',
        '--top-count',
        '3',
        '--index-base-url',
        'https://example.com/manual-index-base/',
      ]),
    ).toEqual({
      inputPath: '.tmp/issue-summary.json',
      label: 'Manual',
      inputUrl: 'https://example.com/manual-input',
      publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      topCount: 3,
      indexBaseUrl: 'https://example.com/manual-index-base',
    })
  })

  it('accepts legacy summary alias and validates top count', () => {
    expect(() =>
      parseIssueReportSummaryArtifactsArgs(['tsx', 'scripts/ops/issueReportSummaryArtifacts.ts']),
    ).toThrow('input is required')
    expect(() =>
      parseIssueReportSummaryArtifactsArgs([
        'tsx',
        'scripts/ops/issueReportSummaryArtifacts.ts',
        '--summary',
        '.tmp/issue-summary.json',
        '--top-count',
        '0',
      ]),
    ).toThrow('top count must be a positive integer')
  })

  it('rejects conflicting input aliases', () => {
    expect(() =>
      parseIssueReportSummaryArtifactsArgs([
        'tsx',
        'scripts/ops/issueReportSummaryArtifacts.ts',
        '--input',
        '.tmp/issue-summary.json',
        '--summary',
        '.tmp/other.json',
      ]),
    ).toThrow('input must not conflict between --input and --summary')
  })
})
