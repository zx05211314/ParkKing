import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  appendPublishGateLog,
  buildPublishGateSummaryMarkdown,
  writePublishGateSummaryFile,
  writePublishGateSummaryMarkdownFile,
} from './publishGateArtifactFiles'
import type { PublishGateRunSummary } from './publishGateRunSummary'

const buildSummary = (): PublishGateRunSummary => ({
  generatedAt: '2026-03-21T00:00:00.000Z',
  reportPath: 'report.json',
  mode: 'strict',
  allowWarn: false,
  allowFail: true,
  allowFailRequested: true,
  allowBaselineAdopt: true,
  overrideReason: 'baseline adopt xinyi',
  bootstrap: {
    requested: true,
    modeUsed: true,
    denied: false,
    previousPackExists: false,
  },
  baselineAdopt: {
    enabled: true,
    applied: true,
    districtIds: ['xinyi'],
    reason: 'baseline_adopt',
  },
  gateMessageFlags: [
    'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH',
    'BASELINE_ADOPT_APPLIED',
  ],
  totals: { info: 0, warn: 1, fail: 2 },
  districts: [
    {
      districtId: 'xinyi',
      info: 0,
      warn: 1,
      fail: 2,
      topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
      topFailCodes: ['HASH_MISMATCH'],
      signOverrideBreakdown: {
        total: 4,
        matchedBySegmentId: 3,
        matchedBySpatial: 1,
        unmatchedNamed: 2,
      },
    },
  ],
  exitCode: 3,
})

describe('publishGateArtifactFiles', () => {
  it('writes the summary file into the _ops directory', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-artifacts-'))

    await writePublishGateSummaryFile(baseDir, buildSummary())

    const summaryFile = JSON.parse(
      await fs.readFile(path.join(baseDir, '_ops', 'publish_gate_summary.json'), 'utf-8'),
    )

    expect(summaryFile).toMatchObject({
      reportPath: 'report.json',
      exitCode: 3,
    })
  })

  it('renders and writes the markdown summary with district override breakdowns', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-artifacts-'))
    const summary = buildSummary()

    expect(buildPublishGateSummaryMarkdown(summary)).toContain('# Publish gate summary')
    expect(buildPublishGateSummaryMarkdown(summary)).toContain(
      '| xinyi | 0 | 1 | 2 | METRIC_SIGN_OVERRIDE_UNMATCHED | HASH_MISMATCH | 3 | 1 | 2 |',
    )

    await writePublishGateSummaryMarkdownFile(baseDir, summary)

    await expect(
      fs.readFile(path.join(baseDir, '_ops', 'publish_gate_summary.md'), 'utf-8'),
    ).resolves.toContain('## Districts')
  })

  it('appends jsonl entries into the _ops log files', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-artifacts-'))

    await appendPublishGateLog(baseDir, 'publish_gate_failures.jsonl', {
      reportPath: 'report.json',
      exitCode: 3,
    })
    await appendPublishGateLog(baseDir, 'publish_gate_failures.jsonl', {
      reportPath: 'report-next.json',
      exitCode: 1,
    })

    const lines = (
      await fs.readFile(path.join(baseDir, '_ops', 'publish_gate_failures.jsonl'), 'utf-8')
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

    expect(lines).toEqual([
      {
        reportPath: 'report.json',
        exitCode: 3,
      },
      {
        reportPath: 'report-next.json',
        exitCode: 1,
      },
    ])
  })
})
