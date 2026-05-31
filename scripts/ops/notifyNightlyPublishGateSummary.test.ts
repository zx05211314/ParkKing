import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'

import {
  hasNightlyPublishGateAlerts,
  loadNightlyPublishGateSummary,
} from './notifyNightlyPublishGateSummary'

describe('notifyNightlyPublishGateSummary', () => {
  it('loads a bounded publish gate summary with top districts', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-gate-'))
    const summaryPath = path.join(baseDir, 'publish_gate_summary.json')
    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          generatedAt: '2026-04-06T00:00:00.000Z',
          reportPath: 'report.json',
          mode: 'strict',
          allowWarn: false,
          allowFail: true,
          allowFailRequested: true,
          allowBaselineAdopt: false,
          overrideReason: 'ci fixture override',
          bootstrap: {
            requested: false,
            modeUsed: false,
            denied: false,
            previousPackExists: true,
          },
          baselineAdopt: {
            enabled: false,
            applied: false,
            districtIds: [],
            reason: null,
          },
          gateMessageFlags: [],
          totals: {
            info: 0,
            warn: 2,
            fail: 3,
          },
          districts: [
            {
              districtId: 'xinyi',
              info: 0,
              warn: 1,
              fail: 3,
              topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
              topFailCodes: ['HASH_MISMATCH'],
              signOverrideBreakdown: {
                total: 4,
                matchedBySegmentId: 3,
                matchedBySpatial: 1,
                unmatchedNamed: 2,
              },
            },
            {
              districtId: 'daan',
              info: 0,
              warn: 1,
              fail: 0,
              topWarnCodes: ['COUNT_DELTA'],
              topFailCodes: [],
            },
            {
              districtId: 'zhongshan',
              info: 1,
              warn: 0,
              fail: 0,
              topWarnCodes: [],
              topFailCodes: [],
            },
          ],
          exitCode: 0,
        },
        null,
        2,
      ),
      'utf-8',
    )

    const summary = await loadNightlyPublishGateSummary(summaryPath)

    expect(summary).toMatchObject({
      mode: 'strict',
      allowFail: true,
      overrideReason: 'ci fixture override',
      totals: {
        warn: 2,
        fail: 3,
      },
      topDistricts: [
        {
          districtId: 'xinyi',
          warn: 1,
          fail: 3,
          signOverrideBreakdown: {
            matchedBySegmentId: 3,
            matchedBySpatial: 1,
            unmatchedNamed: 2,
          },
        },
        {
          districtId: 'daan',
          warn: 1,
          fail: 0,
        },
      ],
    })
    expect(summary?.topDistricts).toHaveLength(2)
    expect(hasNightlyPublishGateAlerts(summary)).toBe(true)
  })

  it('treats missing summaries as no alerts', async () => {
    expect(await loadNightlyPublishGateSummary(null)).toBeNull()
    expect(hasNightlyPublishGateAlerts(null)).toBe(false)
  })

  it('returns null when the summary file does not exist', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-gate-missing-'))
    await expect(
      loadNightlyPublishGateSummary(path.join(baseDir, 'missing.json')),
    ).resolves.toBeNull()
  })
})
