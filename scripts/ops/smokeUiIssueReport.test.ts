import { describe, expect, it } from 'vitest'
import {
  buildSmokeUiIssueReportUrl,
  buildSmokeUiIssueReportsUrl,
  findSmokeUiIssueReportRemoteIssue,
  parseSmokeUiIssueReportArgs,
} from './smokeUiIssueReport'

describe('smokeUiIssueReport', () => {
  it('parses preview smoke options', () => {
    expect(
      parseSmokeUiIssueReportArgs([
        'node',
        'smokeUiIssueReport',
        '--district',
        'daan',
        '--start-preview',
        '--preview-port',
        '4174',
        '--timeout-ms',
        '30000',
        '--sync-issues-url',
        '/api/sync/issues?scope=smoke',
      ]),
    ).toEqual({
      appUrl: 'http://127.0.0.1:4173',
      district: 'daan',
      chromePath: undefined,
      cdpPort: undefined,
      timeoutMs: 30000,
      startPreview: true,
      previewPort: 4174,
      syncIssuesUrl: '/api/sync/issues?scope=smoke',
    })
  })

  it('builds the dataset URL without dropping existing query params', () => {
    expect(
      buildSmokeUiIssueReportUrl({
        appUrl: 'http://127.0.0.1:4173/?view=MAP',
        district: 'xinyi',
      }),
    ).toBe('http://127.0.0.1:4173/?view=MAP&dataset=xinyi')
  })

  it('resolves the default same-origin issue endpoint', () => {
    expect(
      buildSmokeUiIssueReportsUrl({
        appUrl: 'http://127.0.0.1:4173/?dataset=xinyi',
      }),
    ).toBe('http://127.0.0.1:4173/api/sync/issues')
  })

  it('finds the submitted issue in a sync issue envelope', () => {
    expect(
      findSmokeUiIssueReportRemoteIssue(
        {
          issues: [
            { issueId: 'issue-a' },
            { issueId: 'issue-b' },
          ],
        },
        'issue-b',
      ),
    ).toEqual({
      issueCount: 2,
      found: true,
    })
  })
})
