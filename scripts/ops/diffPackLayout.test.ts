import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { detectPackLayout, resolvePrevFromNext } from './diffPackLayout'

describe('diffPackLayout', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await fs.rm(dir, { recursive: true, force: true })
      }),
    )
  })

  it('detects a single-district pack and prefers districtId from meta', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-layout-'))
    tempDirs.push(dir)
    await fs.writeFile(
      path.join(dir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'alpha' }),
      'utf-8',
    )

    const layout = await detectPackLayout(dir)

    expect(layout.kind).toBe('single')
    expect(Array.from(layout.districts.entries())).toEqual([['alpha', dir]])
  })

  it('detects a multi-district pack and ignores hidden and _ops directories', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-layout-'))
    tempDirs.push(dir)
    await fs.mkdir(path.join(dir, 'alpha'))
    await fs.mkdir(path.join(dir, 'beta'))
    await fs.mkdir(path.join(dir, '.hidden'))
    await fs.mkdir(path.join(dir, '_ops'))
    await fs.writeFile(path.join(dir, 'alpha', 'dataset_meta.json'), '{}', 'utf-8')
    await fs.writeFile(path.join(dir, 'beta', 'dataset_meta.json'), '{}', 'utf-8')
    await fs.writeFile(path.join(dir, '_ops', 'dataset_meta.json'), '{}', 'utf-8')

    const layout = await detectPackLayout(dir)

    expect(layout.kind).toBe('multi')
    expect(Array.from(layout.districts.keys())).toEqual(['alpha', 'beta'])
  })

  it('resolves the previous pack from a staging single-district next pack', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'parkking-diff-layout-'))
    tempDirs.push(root)
    const districtDir = path.join(root, 'alpha')
    const stagingDir = path.join(root, '.staging', 'next-alpha')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.mkdir(stagingDir, { recursive: true })
    await fs.writeFile(
      path.join(districtDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'alpha' }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(stagingDir, 'dataset_meta.json'),
      JSON.stringify({ districtId: 'alpha' }),
      'utf-8',
    )

    await expect(resolvePrevFromNext(stagingDir)).resolves.toBe(districtDir)
  })
})
