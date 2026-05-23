import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadPublishGateDatasetValidationContext } from './publishGateDatasetValidationContext'

describe('publishGateDatasetValidationContext', () => {
  it('returns invalid status for unknown district ids', async () => {
    await expect(
      loadPublishGateDatasetValidationContext('unknown'),
    ).resolves.toEqual({
      status: 'invalid',
      warnings: [
        expect.objectContaining({
          code: 'DISTRICT_ID_MISSING',
          severity: 'FAIL',
        }),
      ],
    })
  })

  it('returns missing-pack status when no dataset directory exists', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-gate-context-'))
    const districtId = '__missing_publish_gate_context__'
    await expect(
      loadPublishGateDatasetValidationContext(districtId, base),
    ).resolves.toEqual({
      status: 'missing-pack',
      warnings: [
        expect.objectContaining({
          code: 'PACK_MISSING',
          severity: 'FAIL',
        }),
      ],
    })
  })
})
