import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'

import {
  listDistrictSourceManifests,
  resolveDistrictConfigPath,
  resolveDistrictId,
} from './fetchSourcesManifestDistricts'

describe('fetchSourcesManifestDistricts', () => {
  it('resolves a single inferred district but rejects ambiguous destinations', () => {
    expect(
      resolveDistrictId({}, ['data/raw/xinyi/one.geojson', 'data/raw/xinyi/two.geojson']),
    ).toBe('xinyi')

    expect(
      resolveDistrictId({}, ['data/raw/xinyi/one.geojson', 'data/raw/daan/two.geojson']),
    ).toBeNull()
  })

  it('resolves relative config paths from the manifest directory', async () => {
    const manifestDir = await fs.mkdtemp(path.join(tmpdir(), 'fetch-manifest-districts-'))
    const configPath = path.join(manifestDir, 'xinyi.json')
    await fs.writeFile(configPath, '{"districtId":"xinyi"}', 'utf-8')

    await expect(
      resolveDistrictConfigPath({ configPath: 'xinyi.json' }, manifestDir, 'xinyi'),
    ).resolves.toBe(path.resolve(configPath))
  })

  it('returns explicit districts array when present', () => {
    const districts = listDistrictSourceManifests({
      districts: [{ districtId: 'xinyi' }, { districtId: 'daan' }],
    })

    expect(districts).toHaveLength(2)
    expect(districts[0]?.districtId).toBe('xinyi')
    expect(districts[1]?.districtId).toBe('daan')
  })
})
