import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { readConfig } from './readConfig'

describe('readConfig', () => {
  it('reads config files with aliases and defaults', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'read-config-'))
    const sourceDir = path.join(base, 'inputs')
    await fs.mkdir(sourceDir, { recursive: true })

    for (const fileName of [
      'boundary.geojson',
      'red.geojson',
      'bus.geojson',
      'hydrants.geojson',
      'crosswalks.geojson',
    ]) {
      await fs.writeFile(path.join(sourceDir, fileName), '{}', 'utf-8')
    }

    const configPath = path.join(base, 'config.json')
    await fs.writeFile(
      configPath,
      JSON.stringify({
        districtId: 'Xinyi Test',
        boundary: {
          featureId: 7,
          aliases: ['信義區'],
        },
        inputs: {
          district_bounds: './inputs/boundary.geojson',
          red_yellow: './inputs/red.geojson',
          bus_stops: './inputs/bus.geojson',
          hydrants: './inputs/hydrants.geojson',
          cross_walks: './inputs/crosswalks.geojson',
        },
      }),
      'utf-8',
    )

    const config = await readConfig(['node', 'readConfig', '--config', configPath])

    expect(config.districtId).toBe('xinyi-test')
    expect(config.boundary.featureId).toBe('7')
    expect(config.boundary.names).toEqual(['信義區'])
    expect(config.inputs.crosswalks).toMatch(/inputs[\\/]crosswalks\.geojson$/)
    expect(config.outputs.generatedDir).toMatch(/data[\\/]generated[\\/]xinyi-test$/)
    expect(config.sourceFiles).toHaveLength(5)
    expect(config.configHash).toHaveLength(64)
    expect(config.datasetHash).toHaveLength(64)
  })
})
