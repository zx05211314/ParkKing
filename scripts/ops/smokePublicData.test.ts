import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { runSmokePublicData } from './smokePublicData'

describe('smokePublicData', () => {
  it('passes when registry and district metadata are present', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-public-data-'))
    const districtDir = path.join(baseDir, 'xinyi')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(
      path.join(baseDir, 'registry.json'),
      JSON.stringify({ districts: [{ districtId: 'xinyi' }] }, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }, null, 2),
      'utf-8',
    )

    await expect(runSmokePublicData({ baseDir })).resolves.toMatchObject({
      districtIds: ['xinyi'],
      registryFound: true,
    })
  })

  it('fails with clear message when dataset_meta.json is missing', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-public-data-fail-'))
    await fs.mkdir(path.join(baseDir, 'xinyi'), { recursive: true })

    await expect(runSmokePublicData({ baseDir })).rejects.toThrow(
      /\[xinyi\] dataset_meta\.json missing/,
    )
  })
})
