import { describe, expect, it } from 'vitest'
import { parseIssueReportArtifactSummaryJsonArgs } from './issueReportArtifactSummaryJsonArgs'

describe('issueReportArtifactSummaryJsonArgs', () => {
  it('parses artifact summary validation flags', () => {
    expect(
      parseIssueReportArtifactSummaryJsonArgs([
        'node',
        'issueReportArtifactSummaryJson.ts',
        '--input',
        '.tmp/manifest.json',
        '--json',
      ]),
    ).toEqual({
      inputPath: '.tmp/manifest.json',
      outPath: null,
      json: true,
      writeIndexSurface: false,
    })
  })

  it('parses optional out path', () => {
    expect(
      parseIssueReportArtifactSummaryJsonArgs([
        'node',
        'issueReportArtifactSummaryJson.ts',
        '--summary',
        '.tmp/index-summary.json',
        '--out',
        '.tmp/index-surface.json',
      ]),
    ).toEqual({
      inputPath: '.tmp/index-summary.json',
      outPath: '.tmp/index-surface.json',
      json: false,
      writeIndexSurface: false,
    })
  })

  it('parses the canonical write flag', () => {
    expect(
      parseIssueReportArtifactSummaryJsonArgs([
        'node',
        'issueReportArtifactSummaryJson.ts',
        '--input',
        '.tmp/manifest.json',
        '--json',
        '--write-index-surface',
      ]),
    ).toEqual({
      inputPath: '.tmp/manifest.json',
      outPath: null,
      json: true,
      writeIndexSurface: true,
    })
  })

  it('requires an input path', () => {
    expect(() =>
      parseIssueReportArtifactSummaryJsonArgs([
        'node',
        'issueReportArtifactSummaryJson.ts',
      ]),
    ).toThrow('input is required')
  })

  it('rejects conflicting input aliases', () => {
    expect(() =>
      parseIssueReportArtifactSummaryJsonArgs([
        'node',
        'issueReportArtifactSummaryJson.ts',
        '--input',
        '.tmp/a.json',
        '--summary',
        '.tmp/b.json',
      ]),
    ).toThrow('input must not conflict between --input and --summary')
  })
})
