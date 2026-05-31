import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  writePublishGateArtifacts,
} from './publishGateOutputs'
import { buildPublishGateRunSummary } from './publishGateRunSummary'

describe('publishGateOutputs', () => {
  it('writes summary, override, baseline-adopt, and failure logs when applicable', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-outputs-'))
    const summary = buildPublishGateRunSummary({
      reportPath: 'report.json',
      mode: 'strict',
      allowWarn: false,
      allowFailRequested: true,
      allowBaselineAdopt: true,
      overrideReason: 'baseline adopt xinyi',
      bootstrapState: {
        requested: true,
        previousPackExists: false,
        modeUsed: true,
        denied: false,
        effectiveAllowFail: true,
        gateMessageFlags: ['BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH'],
      },
      baselineAdoptState: {
        checkedDistricts: [],
        applied: true,
        districtIds: ['xinyi'],
        gateMessageFlags: [
          'BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH',
          'BASELINE_ADOPT_APPLIED',
        ],
      },
      totals: { info: 0, warn: 1, fail: 2 },
      districts: [],
      exitCode: 3,
    })

    await writePublishGateArtifacts({
      outputDir: baseDir,
      summary,
    })

    const opsDir = path.join(baseDir, '_ops')
    const summaryFile = JSON.parse(
      await fs.readFile(path.join(opsDir, 'publish_gate_summary.json'), 'utf-8'),
    )
    const summaryMarkdown = await fs.readFile(
      path.join(opsDir, 'publish_gate_summary.md'),
      'utf-8',
    )
    const overrideLog = (
      await fs.readFile(path.join(opsDir, 'publish_gate_overrides.jsonl'), 'utf-8')
    ).trim()
    const baselineLog = (
      await fs.readFile(path.join(opsDir, 'baseline_adopt_stamps.jsonl'), 'utf-8')
    ).trim()
    const failureLog = (
      await fs.readFile(path.join(opsDir, 'publish_gate_failures.jsonl'), 'utf-8')
    ).trim()

    expect(summaryFile).toMatchObject({
      reportPath: 'report.json',
      exitCode: 3,
    })
    expect(summaryMarkdown).toContain('# Publish gate summary')
    expect(JSON.parse(overrideLog)).toMatchObject({
      reportPath: 'report.json',
      allowFail: true,
      allowFailRequested: true,
      baselineAdoptApplied: true,
    })
    expect(JSON.parse(baselineLog)).toMatchObject({
      reportPath: 'report.json',
      districtIds: ['xinyi'],
      reason: 'baseline_adopt',
    })
    expect(JSON.parse(failureLog)).toMatchObject({
      reportPath: 'report.json',
      exitCode: 3,
      totals: { info: 0, warn: 1, fail: 2 },
    })
  })
})
