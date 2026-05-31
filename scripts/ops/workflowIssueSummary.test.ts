import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  appendWorkflowIssueSummary,
  parseWorkflowIssueSummaryArgs,
} from './workflowIssueSummary'
import { appendWorkflowSummary } from './workflowSummary'
import type { WorkflowIssueSummaryRunners } from './workflowIssueSummary'

describe('workflowIssueSummary', () => {
  it('parses manifest summary args', () => {
    expect(
      parseWorkflowIssueSummaryArgs([
        'node',
        'workflow-issue-summary',
        '--manifest',
        '.tmp/issues/manifest.json',
        '--summary',
        'summary.md',
        '--label',
        'Publish',
        '--input-url-env',
        'ISSUE_INDEX_URL',
        '--publish-gate-summary-url-env',
        'PUBLISH_GATE_URL',
        '--top-count',
        '3',
      ]),
    ).toEqual({
      manifestPath: '.tmp/issues/manifest.json',
      summaryPath: 'summary.md',
      label: 'Publish',
      inputUrlEnv: 'ISSUE_INDEX_URL',
      publishGateSummaryUrlEnv: 'PUBLISH_GATE_URL',
      topCount: 3,
    })
  })

  it('builds validation and artifact summaries with env-backed URLs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'workflow-issue-summary-'))
    const summaryPath = path.join(base, 'summary.md')
    const calls: Array<Record<string, unknown>> = []
    const runners: WorkflowIssueSummaryRunners = {
      buildManifestValidation: async (manifestPath) => {
        calls.push({ type: 'validation', manifestPath })
        return 'Valid issue manifest'
      },
      buildArtifactSummary: async (params) => {
        calls.push({ type: 'artifact', ...params })
        return `Issue summary ${params.label} ${params.inputUrl} ${params.publishGateSummaryUrl}`
      },
      appendSummary: appendWorkflowSummary,
    }

    const result = await appendWorkflowIssueSummary(
      {
        manifestPath: '.tmp/issues/manifest.json',
        summaryPath,
        label: 'Publish',
        inputUrlEnv: 'ISSUE_INDEX_URL',
        publishGateSummaryUrlEnv: 'PUBLISH_GATE_URL',
      },
      {
        ISSUE_INDEX_URL: 'https://example.test/index',
        PUBLISH_GATE_URL: 'https://example.test/publish',
      },
      runners,
    )

    const summary = await fs.readFile(summaryPath, 'utf-8')
    expect(result.summary.appended).toBe(true)
    expect(calls).toEqual([
      { type: 'validation', manifestPath: '.tmp/issues/manifest.json' },
      {
        type: 'artifact',
        manifestPath: '.tmp/issues/manifest.json',
        label: 'Publish',
        inputUrl: 'https://example.test/index',
        publishGateSummaryUrl: 'https://example.test/publish',
        topCount: 5,
      },
    ])
    expect(summary).toContain('Valid issue manifest')
    expect(summary).toContain(
      'Issue summary Publish https://example.test/index https://example.test/publish',
    )
  })
})
