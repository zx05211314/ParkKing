import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  listSmokePublicDistrictDirs,
  readSmokePublicRegistryDistrictIds,
  smokePublicDataDirectoryExists,
  smokePublicDataFileExists,
} from './smokePublicDataFiles'

describe('smokePublicDataFiles', () => {
  it('reads registry district ids and filters system directories', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-public-files-'))
    await fs.mkdir(path.join(baseDir, 'xinyi'))
    await fs.mkdir(path.join(baseDir, '_ops'))
    await fs.writeFile(
      path.join(baseDir, 'registry.json'),
      JSON.stringify({ districts: [{ districtId: 'xinyi' }, { districtId: 'daan' }] }),
      'utf-8',
    )

    await expect(readSmokePublicRegistryDistrictIds(baseDir)).resolves.toEqual([
      'daan',
      'xinyi',
    ])
    await expect(listSmokePublicDistrictDirs(baseDir)).resolves.toEqual(['xinyi'])
    await expect(smokePublicDataDirectoryExists(baseDir)).resolves.toBe(true)
    await expect(smokePublicDataFileExists(path.join(baseDir, 'registry.json'))).resolves.toBe(
      true,
    )
  })
})
