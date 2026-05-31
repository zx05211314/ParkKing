import { describe, expect, it } from 'vitest'
import {
  parseWorkflowIssueArtifactRefreshArgs,
  refreshWorkflowIssueArtifacts,
  resolveWorkflowIssueArtifactRefreshOptions,
  type WorkflowIssueArtifactRefreshRunners,
} from './workflowIssueArtifactRefresh'

describe('workflowIssueArtifactRefresh', () => {
  it('parses workflow refresh args', () => {
    expect(
      parseWorkflowIssueArtifactRefreshArgs([
        'node',
        'workflow-issue-artifact-refresh',
        '--manifest',
        '.tmp/issues/manifest.json',
        '--label',
        'Publish',
        '--packet-root-url-env',
        'ISSUE_PACKET_URL',
        '--csv-root-url-env',
        'ISSUE_CSV_URL',
        '--publish-gate-summary-url-env',
        'PUBLISH_GATE_URL',
        '--top-count',
        '3',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issues/manifest.json',
      label: 'Publish',
      packetRootUrl: null,
      packetRootUrlEnv: 'ISSUE_PACKET_URL',
      csvRootUrl: null,
      csvRootUrlEnv: 'ISSUE_CSV_URL',
      publishGateSummaryUrl: null,
      publishGateSummaryUrlEnv: 'PUBLISH_GATE_URL',
      topCount: 3,
    })
  })

  it('resolves direct and env-backed artifact URLs', () => {
    expect(
      resolveWorkflowIssueArtifactRefreshOptions(
        {
          manifestPath: '.tmp/issues/manifest.json',
          label: 'Dry-run',
          packetRootUrlEnv: 'ISSUE_PACKET_URL',
          csvRootUrl: 'https://example.test/csv',
          publishGateSummaryUrlEnv: 'PUBLISH_GATE_URL',
        },
        {
          ISSUE_PACKET_URL: 'https://example.test/packets',
          PUBLISH_GATE_URL: 'https://example.test/publish-gate',
        },
      ),
    ).toEqual({
      manifestPath: '.tmp/issues/manifest.json',
      label: 'Dry-run',
      packetRootUrl: 'https://example.test/packets',
      csvRootUrl: 'https://example.test/csv',
      publishGateSummaryUrl: 'https://example.test/publish-gate',
      topCount: 5,
    })
  })

  it('refreshes manifest URLs before rebuilding summary sidecars', async () => {
    const calls: Array<Record<string, unknown>> = []
    const runners: WorkflowIssueArtifactRefreshRunners = {
      buildWorkflowArtifacts: async (args) => {
        calls.push({ type: 'manifest', args })
        return {
          manifestPath: args.manifestPath ?? 'missing',
          packetRootPath: '.tmp/issues/packets',
          csvRootPath: '.tmp/issues/csv',
        }
      },
      writeIndexSummaries: async (options) => {
        calls.push({ type: 'summaries', options })
        return {
          artifactIndexPath: '.tmp/issues/artifact-index.json',
          indexSummaryJsonPath: '.tmp/issues/index-summary.json',
          indexSurfacePath: '.tmp/issues/index-surface.json',
          indexSummaryPath: '.tmp/issues/index-summary.md',
        }
      },
    }

    const result = await refreshWorkflowIssueArtifacts(
      {
        manifestPath: '.tmp/issues/manifest.json',
        label: 'Nightly',
        packetRootUrlEnv: 'ISSUE_PACKET_URL',
        csvRootUrlEnv: 'ISSUE_CSV_URL',
        publishGateSummaryUrlEnv: 'PUBLISH_GATE_URL',
      },
      {
        ISSUE_PACKET_URL: 'https://example.test/packets',
        ISSUE_CSV_URL: 'https://example.test/csv',
        PUBLISH_GATE_URL: 'https://example.test/publish-gate',
      },
      runners,
    )

    expect(calls).toEqual([
      {
        type: 'manifest',
        args: expect.objectContaining({
          manifestPath: '.tmp/issues/manifest.json',
          packetRootUrl: 'https://example.test/packets',
          csvRootUrl: 'https://example.test/csv',
        }),
      },
      {
        type: 'summaries',
        options: {
          manifestPath: '.tmp/issues/manifest.json',
          label: 'Nightly',
          packetRootUrl: 'https://example.test/packets',
          csvRootUrl: 'https://example.test/csv',
          publishGateSummaryUrl: 'https://example.test/publish-gate',
          topCount: 5,
        },
      },
    ])
    expect(result).toMatchObject({
      manifestPath: '.tmp/issues/manifest.json',
      artifactIndexPath: '.tmp/issues/artifact-index.json',
      indexSummaryPath: '.tmp/issues/index-summary.md',
    })
  })
})
