import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newDistrict } from './newDistrict'

const originalCwd = process.cwd()

describe('newDistrict', () => {
  let workdir: string

  beforeEach(async () => {
    workdir = await fs.mkdtemp(path.join(os.tmpdir(), 'new-district-'))
    process.chdir(workdir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
  })

  it('writes an expansion config under the requested output root', async () => {
    await newDistrict({
      districtId: 'songshan',
      districtName: 'Songshan',
      sourceRoot: 'data/sources/shared',
      outputRoot: 'configs/expansion',
      sourcePreset: 'taipei-shared',
      boundaryFeatureId: '63001',
      force: false,
    })

    const configPath = path.join(workdir, 'configs', 'expansion', 'songshan.json')
    const raw = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as { districtId?: string; boundary?: { featureId?: string } }

    expect(parsed.districtId).toBe('songshan')
    expect(parsed.boundary?.featureId).toBe('63001')
  })

  it('does not overwrite an existing config without force', async () => {
    await fs.mkdir(path.join(workdir, 'configs', 'expansion'), { recursive: true })
    const configPath = path.join(workdir, 'configs', 'expansion', 'songshan.json')
    await fs.writeFile(configPath, '{"districtId":"existing"}\n', 'utf-8')

    await expect(
      newDistrict({
        districtId: 'songshan',
        districtName: 'Songshan',
        sourceRoot: 'data/sources/shared',
        outputRoot: 'configs/expansion',
        sourcePreset: 'taipei-shared',
        boundaryFeatureId: '63001',
        force: false,
      }),
    ).rejects.toThrow('Config already exists')

    await expect(fs.readFile(configPath, 'utf-8')).resolves.toBe(
      '{"districtId":"existing"}\n',
    )
  })
})
