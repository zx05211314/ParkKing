import { describe, expect, it } from 'vitest'
import { parseIssueReportArtifactIndexArgs } from './issueReportArtifactIndexArgs'

describe('issueReportArtifactIndexArgs', () => {
  it('parses required manifest path and optional outputs', () => {
    expect(
      parseIssueReportArtifactIndexArgs([
        'node',
        'issueReportArtifactIndex.ts',
        '--manifest',
        '.tmp/issue-report-artifacts/manifest.json',
        '--out',
        '.tmp/issue-report-artifact-index.json',
        '--json',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-report-artifacts/manifest.json',
      outPath: '.tmp/issue-report-artifact-index.json',
      writeArtifactIndex: false,
      json: true,
    })
  })

  it('parses canonical artifact-index writes from the workflow manifest', () => {
    expect(
      parseIssueReportArtifactIndexArgs([
        'node',
        'issueReportArtifactIndex.ts',
        '--manifest',
        '.tmp/issue-report-artifacts/manifest.json',
        '--json',
        '--write-artifact-index',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-report-artifacts/manifest.json',
      outPath: null,
      writeArtifactIndex: true,
      json: true,
    })
  })

  it('uses defaults when only manifest is provided', () => {
    expect(
      parseIssueReportArtifactIndexArgs([
        'node',
        'issueReportArtifactIndex.ts',
        '--manifest',
        '.tmp/issue-report-artifacts/manifest.json',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-report-artifacts/manifest.json',
      outPath: null,
      writeArtifactIndex: false,
      json: false,
    })
  })

  it('throws when manifest is missing', () => {
    expect(() =>
      parseIssueReportArtifactIndexArgs(['node', 'issueReportArtifactIndex.ts']),
    ).toThrow('manifest is required')
  })
})
