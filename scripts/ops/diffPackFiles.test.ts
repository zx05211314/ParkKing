import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildFileMap, readMeta } from './diffPackFiles'

describe('diffPackFiles', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await fs.rm(dir, { recursive: true, force: true })
      }),
    )
  })

  it('reuses valid file entries from dataset meta', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-files-'))
    tempDirs.push(dir)
    await fs.writeFile(path.join(dir, 'dataset_meta.json'), '{}\n', 'utf-8')
    await fs.writeFile(
      path.join(dir, 'segments.geojson'),
      '{"type":"FeatureCollection"}\n',
      'utf-8',
    )

    const fileMap = await buildFileMap(dir, {
      'dataset_meta.json': { sha256: 'meta-sha', bytes: 3 },
      'segments.geojson': { sha256: 'fixture-sha', bytes: 29 },
    })

    expect(fileMap.get('segments.geojson')).toEqual({
      sha256: 'fixture-sha',
      bytes: 29,
    })
  })

  it('returns null for unreadable dataset meta', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-meta-'))
    tempDirs.push(dir)
    await fs.writeFile(path.join(dir, 'dataset_meta.json'), '{invalid', 'utf-8')

    await expect(readMeta(dir)).resolves.toBeNull()
  })
})
