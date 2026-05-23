import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { resolvePublishGateBootstrapState } from './publishGateBootstrapDecision'

describe('publishGateBootstrapDecision', () => {
  it('resolves bootstrap mode and flags based on existing published packs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-bootstrap-'))
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
})
