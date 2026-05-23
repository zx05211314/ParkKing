import { describe, expect, it } from 'vitest'

import { parseNotifyNightlyArgs } from './notifyNightlyArgs'

describe('notifyNightlyArgs', () => {
  it('collects repeated diff flags in order', () => {
    expect(
      parseNotifyNightlyArgs([
        'node',
        'notifyNightly.ts',
        '--diff',
        'a',
        '--diff',
        'b',
      ]),
    ).toEqual({
      diffPaths: ['a', 'b'],
      syncStorePath: null,
      issueInputPath: null,
      issueLimit: 5,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 5,
      issueInputUrl: null,
      issuePacketUrl: null,
      issueCsvUrl: null,
      publishGateSummaryPath: null,
      publishGateSummaryUrl: null,
    })
  })

  it('parses optional sync and issue artifact flags', () => {
    expect(
      parseNotifyNightlyArgs([
        'node',
        'notifyNightly.ts',
        '--diff',
        'a',
        '--sync-store',
        '.tmp/sync-service.json',
        '--issue-input',
        '.tmp/nightly-issue-artifacts/artifact-index.json',
        '--issue-limit',
        '3',
        '--issue-packet-out',
        '.tmp/nightly-issue-packets',
        '--issue-csv-out',
        '.tmp/nightly-issue-csv',
        '--issue-packet-issue-limit',
        '2',
        '--issue-input-url',
        'https://example.com/index',
        '--issue-packet-url',
        'https://example.com/packets',
        '--issue-csv-url',
        'https://example.com/csv',
        '--publish-gate-summary',
        'public/data/generated/_ops/publish_gate_summary.json',
        '--publish-gate-summary-url',
        'https://example.com/publish-gate-summary',
      ]),
    ).toEqual({
      diffPaths: ['a'],
      syncStorePath: '.tmp/sync-service.json',
      issueInputPath: '.tmp/nightly-issue-artifacts/artifact-index.json',
      issueLimit: 3,
      issuePacketOutPath: '.tmp/nightly-issue-packets',
      issueCsvOutPath: '.tmp/nightly-issue-csv',
      issuePacketIssueLimit: 2,
      issueInputUrl: 'https://example.com/index',
      issuePacketUrl: 'https://example.com/packets',
      issueCsvUrl: 'https://example.com/csv',
      publishGateSummaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
      publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
    })
  })

  it('rejects conflicting issue input aliases', () => {
    expect(() =>
      parseNotifyNightlyArgs([
        'node',
        'notifyNightly.ts',
        '--issue-input',
        '.tmp/a.json',
        '--issue-index',
        '.tmp/b.json',
      ]),
    ).toThrow('issue input must not conflict between --issue-input and --issue-index')
  })

  it('throws for invalid issue limits', () => {
    expect(() =>
      parseNotifyNightlyArgs([
        'node',
        'notifyNightly.ts',
        '--issue-limit',
        '0',
      ]),
    ).toThrow('issue limit must be a positive integer')
  })
})
