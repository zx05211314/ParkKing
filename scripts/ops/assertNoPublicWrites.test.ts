import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { assertNoPublicWrites } from './assertNoPublicWrites'

describe('assertNoPublicWrites', () => {
  it('detects changes in public dir', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'public-check-'))
    const publicDir = path.join(base, 'public', 'data', 'generated')
    await fs.mkdir(publicDir, { recursive: true })

    const snapshotPath = path.join(base, 'snapshot.json')
    await assertNoPublicWrites({ baseDir: publicDir, baselinePath: snapshotPath })

    await fs.writeFile(path.join(publicDir, 'new.json'), '{"ok":true}', 'utf-8')

    await expect(
      assertNoPublicWrites({ baseDir: publicDir, checkPath: snapshotPath }),
    ).rejects.toThrow(/public\/ writes detected/i)
  })
})
