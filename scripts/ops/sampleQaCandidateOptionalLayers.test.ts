import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { loadQaCandidateOptionalLayers } from './sampleQaCandidateOptionalLayers'

const writeJson = async (targetPath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

describe('sampleQaCandidateOptionalLayers', () => {
  it('falls back for optional files and reads dataset meta when present', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'qa-optional-layers-'))

    await writeJson(path.join(baseDir, 'dataset_meta.json'), {
      districtId: 'demo',
      districtName: 'Demo',
      datasetHash: 'demo-hash',
    })

    const layers = await loadQaCandidateOptionalLayers(baseDir)

    expect(layers.crosswalks.features).toEqual([])
    expect(layers.signOverrides.features).toEqual([])
    expect(layers.inferredCandidates.features).toEqual([])
    expect(layers.parkingSpaces.features).toEqual([])
    expect(layers.meta?.districtId).toBe('demo')
  })
})
