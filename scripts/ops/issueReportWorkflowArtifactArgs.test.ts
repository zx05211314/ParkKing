import { describe, expect, it } from 'vitest'
import { parseIssueReportWorkflowArtifactArgs } from './issueReportWorkflowArtifactArgs'

describe('issueReportWorkflowArtifactArgs', () => {
  it('parses custom workflow artifact arguments', () => {
    expect(
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
        '--manifest',
        '.tmp/custom-artifacts/manifest.json',
        '--sync-store',
        '.tmp/custom-sync.json',
        '--out-root',
        '.tmp/custom-artifacts',
        '--limit',
        '7',
        '--packet-issue-limit',
        '3',
        '--publish-gate-summary',
        'public/data/generated/_ops/publish_gate_summary.json',
        '--index-base-url',
        'https://example.com/issue-index',
        '--packet-root-url',
        'https://example.com/issue-packets',
        '--csv-root-url',
        'https://example.com/issue-csv',
      ]),
    ).toEqual({
      manifestPath: '.tmp/custom-artifacts/manifest.json',
      syncStorePath: '.tmp/custom-sync.json',
      outRoot: '.tmp/custom-artifacts',
      limit: 7,
      packetIssueLimit: 3,
      publishGateSummaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
      indexBaseUrl: 'https://example.com/issue-index',
      packetRootUrl: 'https://example.com/issue-packets',
      csvRootUrl: 'https://example.com/issue-csv',
    })
  })

  it('uses defaults when workflow artifact flags are omitted', () => {
    expect(
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
      ]),
    ).toEqual({
      manifestPath: null,
      syncStorePath: null,
      outRoot: '.tmp/issue-report-artifacts',
      limit: 5,
      packetIssueLimit: 5,
      publishGateSummaryPath: null,
      indexBaseUrl: null,
      packetRootUrl: null,
      csvRootUrl: null,
    })
  })

  it('parses manifest-only refresh arguments', () => {
    expect(
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
        '--manifest',
        '.tmp/issue-report-artifacts/manifest.json',
        '--packet-root-url',
        'https://example.com/issue-packets',
        '--csv-root-url',
        'https://example.com/issue-csv',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-report-artifacts/manifest.json',
      syncStorePath: null,
      outRoot: '.tmp/issue-report-artifacts',
      limit: 5,
      packetIssueLimit: 5,
      publishGateSummaryPath: null,
      indexBaseUrl: null,
      packetRootUrl: 'https://example.com/issue-packets',
      csvRootUrl: 'https://example.com/issue-csv',
    })
  })

  it('accepts legacy artifact-url aliases for compatibility', () => {
    expect(
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
        '--packet-artifact-url',
        'https://example.com/issue-packets',
        '--csv-artifact-url',
        'https://example.com/issue-csv',
      ]),
    ).toMatchObject({
      packetRootUrl: 'https://example.com/issue-packets',
      csvRootUrl: 'https://example.com/issue-csv',
    })
  })

  it('throws on conflicting root-url and legacy alias values', () => {
    expect(() =>
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
        '--packet-root-url',
        'https://example.com/root-packets',
        '--packet-artifact-url',
        'https://example.com/legacy-packets',
      ]),
    ).toThrow(
      'packet root url received conflicting values for --packet-root-url and legacy alias --packet-artifact-url',
    )
  })

  it('throws for invalid workflow artifact limits', () => {
    expect(() =>
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
        '--limit',
        '0',
      ]),
    ).toThrow('limit must be a positive integer')
  })

  it('throws for invalid workflow artifact packet limits', () => {
    expect(() =>
      parseIssueReportWorkflowArtifactArgs([
        'node',
        'issueReportWorkflowArtifacts.ts',
        '--packet-issue-limit',
        '0',
      ]),
    ).toThrow('packet issue limit must be a positive integer')
  })
})
