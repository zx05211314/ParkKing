import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadQaCandidateRequiredLayers } from './sampleQaCandidateRequiredLayers'

const writeJson = async (targetPath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

describe('sampleQaCandidateRequiredLayers', () => {
  it('loads the required QA layer files', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'qa-required-layers-'))

    await writeJson(path.join(baseDir, 'red_yellow.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(baseDir, 'bus_stops.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(baseDir, 'hydrants.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(baseDir, 'intersections.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })

    const layers = await loadQaCandidateRequiredLayers(baseDir)

    expect(layers.redYellow.features).toEqual([])
    expect(layers.busStops.features).toEqual([])
    expect(layers.hydrants.features).toEqual([])
    expect(layers.intersections.features).toEqual([])
  })
})
