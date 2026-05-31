import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  applyPublishGateBaselineAdopt,
  resolvePublishGateBootstrapState,
} from './publishGateDecision'

describe('publishGateDecision', () => {
  it('resolves bootstrap mode and flags based on existing published packs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-decision-'))
    const publishedDir = path.join(base, 'xinyi')
    await fs.mkdir(publishedDir, { recursive: true })
    await fs.writeFile(
      path.join(publishedDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    await expect(
      resolvePublishGateBootstrapState({
        districts: [{ districtId: 'daan' }],
        overrideReason: 'taipei-real-bootstrap',
        allowFail: true,
        publishedRootDir: base,
      }),
    ).resolves.toEqual({
      requested: true,
      previousPackExists: false,
      modeUsed: true,
      denied: false,
      effectiveAllowFail: true,
      gateMessageFlags: ['BOOTSTRAP_ALLOW_FAIL_ON_FIRST_PUBLISH'],
    })

    await expect(
      resolvePublishGateBootstrapState({
        districts: [{ districtId: 'xinyi' }],
        overrideReason: 'taipei-real-bootstrap',
        allowFail: true,
        publishedRootDir: base,
      }),
    ).resolves.toEqual({
      requested: true,
      previousPackExists: true,
      modeUsed: false,
      denied: true,
      effectiveAllowFail: false,
      gateMessageFlags: ['BOOTSTRAP_DENIED_PREVIOUS_PACK_EXISTS'],
    })
  })

  it('rewrites adoptable diff fails into warnings and appends the adopt flag', () => {
    const result = applyPublishGateBaselineAdopt({
      checkedDistricts: [
        {
          districtId: 'xinyi',
          warnings: [
            { severity: 'FAIL', code: 'DIFF_SEGMENT_COUNT_DELTA', message: 'adoptable' },
            { severity: 'WARN', code: 'COUNT_DELTA', message: 'warn' },
          ],
        },
      ],
      allowBaselineAdopt: true,
      overrideReason: 'baseline adopt xinyi',
      gateMessageFlags: [],
    })

    expect(result.applied).toBe(true)
    expect(result.districtIds).toEqual(['xinyi'])
    expect(result.gateMessageFlags).toContain('BASELINE_ADOPT_APPLIED')
    expect(result.checkedDistricts[0]?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIFF_SEGMENT_COUNT_DELTA', severity: 'WARN' }),
      ]),
    )
  })

  it('leaves non-adoptable hard fails untouched', () => {
    const checkedDistricts = [
      {
        districtId: 'xinyi',
        warnings: [{ severity: 'FAIL' as const, code: 'PERF_REGRESSION', message: 'hard fail' }],
      },
    ]
    const result = applyPublishGateBaselineAdopt({
      checkedDistricts,
      allowBaselineAdopt: true,
      overrideReason: 'baseline adopt hard fail',
      gateMessageFlags: [],
    })

    expect(result).toEqual({
      checkedDistricts,
      applied: false,
      districtIds: [],
      gateMessageFlags: [],
    })
  })
})
