import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  quickGeojsonGeometryCheck,
  validateDistrictInput,
} from './checkDistrictInputValidation'

describe('checkDistrictInputValidation', () => {
  it('finds geojson type markers quickly from raw text', () => {
    expect(
      Array.from(
        quickGeojsonGeometryCheck(
          '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]}}]}',
        ),
      ),
    ).toContain('Point')
  })

  it('marks files missing geometry types as invalid', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'district-input-'))
    await fs.writeFile(path.join(base, 'broken.geojson'), '{"features":[]}', 'utf-8')

    await expect(
      validateDistrictInput({
        configDir: base,
        key: 'districtBounds',
        value: 'broken.geojson',
      }),
    ).resolves.toEqual({
      key: 'districtBounds',
      path: 'broken.geojson',
      status: 'INVALID',
      detail: 'GeoJSON missing type entries',
    })
  })
})
