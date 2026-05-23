import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkDistrictInputs } from './checkDistrictInputs'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('checkDistrictInputs', () => {
  it('fails when a required input is missing or invalid', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'district-input-check-'))
    await fs.writeFile(
      path.join(base, 'config.json'),
      JSON.stringify({
        inputs: {
          districtBounds: 'missing.geojson',
          redYellow: 'red.geojson',
          busStops: 'bus.geojson',
          hydrants: 'hydrants.geojson',
        },
      }),
      'utf-8',
    )
    await fs.writeFile(
      path.join(base, 'red.geojson'),
      '{"type":"FeatureCollection","features":[]}',
      'utf-8',
    )
    await fs.writeFile(
      path.join(base, 'bus.geojson'),
      '{"type":"FeatureCollection","features":[]}',
      'utf-8',
    )
    await fs.writeFile(
      path.join(base, 'hydrants.geojson'),
      '{"type":"FeatureCollection","features":[]}',
      'utf-8',
    )

    vi.spyOn(console, 'table').mockImplementation(() => {})

    await expect(checkDistrictInputs(path.join(base, 'config.json'))).rejects.toThrow(
      /Missing required inputs: districtBounds/i,
    )
  })
})
