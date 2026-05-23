import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadQaCandidateDataset } from './sampleQaCandidateDataLoad'

const writeJson = async (targetPath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

describe('loadQaCandidateDataset', () => {
  it('loads required files and falls back for optional files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-dataset-load-'))
    const datasetRoot = path.join(base, 'public', 'data', 'generated')
    const districtDir = path.join(datasetRoot, 'demo')

    await writeJson(path.join(districtDir, 'red_yellow.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(districtDir, 'bus_stops.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(districtDir, 'hydrants.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(districtDir, 'intersections.geojson'), {
      type: 'FeatureCollection',
      features: [],
    })
    await writeJson(path.join(districtDir, 'dataset_meta.json'), {
      districtId: 'demo',
      districtName: 'Demo',
      datasetHash: 'demo-hash',
    })

    const dataset = await loadQaCandidateDataset({
      districtId: 'demo',
      datasetRoots: [datasetRoot],
    })

    expect(dataset.baseDir).toBe(districtDir)
    expect(dataset.redYellow.features).toEqual([])
    expect(dataset.crosswalks.features).toEqual([])
    expect(dataset.signOverrides.features).toEqual([])
    expect(dataset.inferredCandidates.features).toEqual([])
    expect(dataset.parkingSpaces.features).toEqual([])
    expect(dataset.meta?.districtId).toBe('demo')
  })
})
