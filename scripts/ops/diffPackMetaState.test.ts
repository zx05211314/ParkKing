import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getMetaFiles, readMeta } from './diffPackMetaState'

describe('diffPackMetaState', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('returns null for unreadable dataset meta and extracts file entries when present', async () => {
    const invalidDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-meta-'))
    tempDirs.push(invalidDir)
    await fs.writeFile(path.join(invalidDir, 'dataset_meta.json'), '{invalid', 'utf-8')
    await expect(readMeta(invalidDir)).resolves.toBeNull()

    const validDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-meta-valid-'))
    tempDirs.push(validDir)
    await fs.writeFile(
      path.join(validDir, 'dataset_meta.json'),
      JSON.stringify({
        files: {
          'segments.geojson': { sha256: 'fixture-sha', bytes: 29 },
        },
      }),
      'utf-8',
    )

    const meta = await readMeta(validDir)
    expect(getMetaFiles(meta)).toEqual({
      'segments.geojson': { sha256: 'fixture-sha', bytes: 29 },
    })
  })
})
