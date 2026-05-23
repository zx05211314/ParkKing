import { describe, expect, it } from 'vitest'
import { parseIssueReportArtifactSummaryArgs } from './issueReportArtifactSummaryArgs'

describe('issueReportArtifactSummaryArgs', () => {
  it('parses custom summary arguments', () => {
    expect(
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
        '--input',
        '.tmp/issue-report-artifacts/artifact-index.json',
        '--out',
        '.tmp/summary.md',
        '--label',
        'Publish',
        '--input-url',
        'https://example.com/issue-index',
        '--publish-gate-summary-url',
        'https://example.com/publish-gate-summary',
        '--top-count',
        '7',
        '--write-index-summary',
      ]),
    ).toEqual({
      inputPath: '.tmp/issue-report-artifacts/artifact-index.json',
      outPath: '.tmp/summary.md',
      label: 'Publish',
      inputUrl: 'https://example.com/issue-index',
      publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      topCount: 7,
      json: false,
      writeIndexSummary: true,
    })
  })

  it('uses defaults when optional summary arguments are omitted', () => {
    expect(
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
        '--input',
        '.tmp/issue-report-artifacts/artifact-index.json',
      ]),
    ).toEqual({
      inputPath: '.tmp/issue-report-artifacts/artifact-index.json',
      outPath: null,
      label: null,
      inputUrl: null,
      publishGateSummaryUrl: null,
      topCount: 5,
      json: false,
      writeIndexSummary: false,
    })
  })

  it('accepts legacy index flags as aliases', () => {
    expect(
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
        '--index',
        '.tmp/issue-report-artifacts/artifact-index.json',
        '--index-url',
        'https://example.com/issue-index',
      ]),
    ).toEqual({
      inputPath: '.tmp/issue-report-artifacts/artifact-index.json',
      outPath: null,
      label: null,
      inputUrl: 'https://example.com/issue-index',
      publishGateSummaryUrl: null,
      topCount: 5,
      json: false,
      writeIndexSummary: false,
    })
  })

  it('parses json output requests', () => {
    expect(
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
        '--input',
        '.tmp/issue-report-artifacts/artifact-index.json',
        '--json',
      ]),
    ).toEqual({
      inputPath: '.tmp/issue-report-artifacts/artifact-index.json',
      outPath: null,
      label: null,
      inputUrl: null,
      publishGateSummaryUrl: null,
      topCount: 5,
      json: true,
      writeIndexSummary: false,
    })
  })

  it('throws when index is missing', () => {
    expect(() =>
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
      ]),
    ).toThrow('input is required')
  })

  it('throws when top count is invalid', () => {
    expect(() =>
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
        '--input',
        '.tmp/issue-report-artifacts/artifact-index.json',
        '--top-count',
        '0',
      ]),
    ).toThrow('top count must be a positive integer')
  })

  it('throws when input aliases conflict', () => {
    expect(() =>
      parseIssueReportArtifactSummaryArgs([
        'node',
        'issueReportArtifactSummary.ts',
        '--input',
        '.tmp/a.json',
        '--index',
        '.tmp/b.json',
      ]),
    ).toThrow('input must not conflict between --input and --index')
  })
})
