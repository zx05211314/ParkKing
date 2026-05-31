import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadSmokeLoadLatestRegistry } from './smokeLoadLatestRegistry'

describe('loadSmokeLoadLatestRegistry', () => {
  it('requires multiple districts when expectedDistricts is empty', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-registry-'))

    await fs.writeFile(
      path.join(baseDir, 'registry.json'),
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
      'utf-8',
    )

    await expect(
      loadSmokeLoadLatestRegistry({ baseDir, expectedDistricts: [] }),
    ).rejects.toThrow('Expected >= 2 districts in registry, got 1')
  })
})
