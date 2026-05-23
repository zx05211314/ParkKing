import { describe, expect, it } from 'vitest'
import { parseIssueReportArtifactManifestArgs } from './issueReportArtifactManifestArgs'

describe('issueReportArtifactManifestArgs', () => {
  it('parses manifest validation flags', () => {
    expect(
      parseIssueReportArtifactManifestArgs([
        'node',
        'issueReportArtifactManifest.ts',
        '--manifest',
        '.tmp/issue-index/manifest.json',
        '--expect',
        'workflow',
        '--json',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-index/manifest.json',
      expectKind: 'workflow',
      followPacketManifest: false,
      followSummaryArtifacts: false,
      json: true,
    })
  })

  it('defaults to any manifest kind', () => {
    expect(
      parseIssueReportArtifactManifestArgs([
        'node',
        'issueReportArtifactManifest.ts',
        '--manifest',
        '.tmp/issue-index/manifest.json',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-index/manifest.json',
      expectKind: 'any',
      followPacketManifest: false,
      followSummaryArtifacts: false,
      json: false,
    })
  })

  it('parses nested packet validation flag', () => {
    expect(
      parseIssueReportArtifactManifestArgs([
        'node',
        'issueReportArtifactManifest.ts',
        '--manifest',
        '.tmp/issue-index/manifest.json',
        '--expect',
        'workflow',
        '--follow-packet',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-index/manifest.json',
      expectKind: 'workflow',
      followPacketManifest: true,
      followSummaryArtifacts: false,
      json: false,
    })
  })

  it('accepts manual artifact manifests as an expected kind', () => {
    expect(
      parseIssueReportArtifactManifestArgs([
        'node',
        'issueReportArtifactManifest.ts',
        '--manifest',
        '.tmp/manual/artifacts-manifest.json',
        '--expect',
        'manual',
      ]),
    ).toEqual({
      manifestPath: '.tmp/manual/artifacts-manifest.json',
      expectKind: 'manual',
      followPacketManifest: false,
      followSummaryArtifacts: false,
      json: false,
    })
  })

  it('parses summary artifact validation flag', () => {
    expect(
      parseIssueReportArtifactManifestArgs([
        'node',
        'issueReportArtifactManifest.ts',
        '--manifest',
        '.tmp/issue-index/manifest.json',
        '--follow-surface',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issue-index/manifest.json',
      expectKind: 'any',
      followPacketManifest: false,
      followSummaryArtifacts: true,
      json: false,
    })
  })

  it('throws for unsupported expect values', () => {
    expect(() =>
      parseIssueReportArtifactManifestArgs([
        'node',
        'issueReportArtifactManifest.ts',
        '--manifest',
        '.tmp/issue-index/manifest.json',
        '--expect',
        'bad',
      ]),
    ).toThrow('expect must be one of: any, workflow, manual, packet')
  })
})
