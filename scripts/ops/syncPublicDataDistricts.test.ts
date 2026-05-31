import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import {
  isSyncPublicDistrictCandidate,
  listSyncPublicDistrictIds,
} from './syncPublicDataDistricts'

describe('syncPublicDataDistricts', () => {
  it('filters hidden and system directories and only returns published districts', async () => {
    const sourceRoot = await fs.mkdtemp(path.join(tmpdir(), 'sync-public-districts-'))
    await fs.mkdir(path.join(sourceRoot, '.backup'), { recursive: true })
    await fs.mkdir(path.join(sourceRoot, '_ops'), { recursive: true })
    await fs.mkdir(path.join(sourceRoot, 'xinyi'), { recursive: true })
    await fs.mkdir(path.join(sourceRoot, 'beta'), { recursive: true })
    await fs.writeFile(
      path.join(sourceRoot, 'xinyi', 'dataset_meta.json'),
      JSON.stringify({ districtId: 'xinyi' }),
      'utf-8',
    )

    expect(isSyncPublicDistrictCandidate('xinyi')).toBe(true)
    expect(isSyncPublicDistrictCandidate('.backup')).toBe(false)
    expect(isSyncPublicDistrictCandidate('_ops')).toBe(false)
    await expect(listSyncPublicDistrictIds(sourceRoot)).resolves.toEqual(['xinyi'])
  })
})
