import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildSmokePublicDistrictIds,
  validateSmokePublicDataDistricts,
} from './smokePublicDataValidation'

describe('smokePublicDataValidation', () => {
  it('builds merged district ids and flags missing metadata files', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'smoke-public-validation-'))
    await fs.mkdir(path.join(baseDir, 'xinyi'), { recursive: true })

    expect(buildSmokePublicDistrictIds(['daan'], ['xinyi', 'daan'])).toEqual([
      'daan',
      'xinyi',
    ])
    await expect(
      validateSmokePublicDataDistricts({
        baseDir,
        districtIds: ['xinyi'],
        registryDistrictIds: null,
      }),
    ).resolves.toEqual([
      `[xinyi] dataset_meta.json missing at ${path.resolve(baseDir, 'xinyi', 'dataset_meta.json')}`,
    ])
  })
})
