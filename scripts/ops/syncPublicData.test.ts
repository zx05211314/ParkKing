import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { syncPublicData } from './syncPublicData'

describe('syncPublicData', () => {
  it('copies district packs and registry into public data root', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'sync-public-data-'))
    const sourceRoot = path.join(baseDir, 'data', 'generated')
    const targetRoot = path.join(baseDir, 'public', 'data', 'generated')

    const districtDir = path.join(sourceRoot, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }, null, 2),
      'utf-8',
    )
    await fs.writeFile(path.join(districtDir, 'red_yellow.geojson'), '{}', 'utf-8')
    await fs.writeFile(
      path.join(sourceRoot, 'registry.json'),
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
      'utf-8',
    )

    await fs.mkdir(path.join(targetRoot, 'xinyi'), { recursive: true })
    await fs.writeFile(path.join(targetRoot, 'xinyi', 'stale.txt'), 'stale', 'utf-8')

    const result = await syncPublicData({
      sourceDir: sourceRoot,
      targetDir: targetRoot,
    })

    expect(result.districtIds).toEqual(['xinyi'])
    await expect(
      fs.access(path.join(targetRoot, 'xinyi', 'dataset_meta.json')),
    ).resolves.toBeUndefined()
    await expect(
      fs.access(path.join(targetRoot, 'registry.json')),
    ).resolves.toBeUndefined()
    await expect(
      fs.access(path.join(targetRoot, 'xinyi', 'stale.txt')),
    ).rejects.toThrow()
  })
})
