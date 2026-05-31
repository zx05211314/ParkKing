import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildFileMap } from './diffPackFileMap'

describe('diffPackFileMap', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    )
  })

  it('reuses valid file entries from dataset meta and hashes unknown files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-files-map-'))
    tempDirs.push(dir)
    await fs.writeFile(path.join(dir, 'dataset_meta.json'), '{}\n', 'utf-8')
    await fs.writeFile(
      path.join(dir, 'segments.geojson'),
      '{"type":"FeatureCollection"}\n',
      'utf-8',
    )

    const fileMap = await buildFileMap(dir, {
      'dataset_meta.json': { sha256: 'meta-sha', bytes: 3 },
    })

    expect(fileMap.get('dataset_meta.json')).toEqual({
      sha256: 'meta-sha',
      bytes: 3,
    })
    expect(fileMap.get('segments.geojson')?.sha256).toHaveLength(64)
    expect(fileMap.get('segments.geojson')?.bytes).toBe(29)
  })
})
