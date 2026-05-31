import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { updateRollbackRegistry } from './rollbackPackRegistry'

describe('rollbackPackRegistry', () => {
  it('replaces the district entry with the published metadata entry', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'rollback-registry-'))
    const metaPath = path.join(baseDir, 'dataset_meta.json')
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          districtName: 'Xinyi',
          schemaVersion: 2,
          datasetHash: 'hash-new',
          generatedAt: '2026-03-01T00:00:00.000Z',
          publishedAt: '2026-03-02T00:00:00.000Z',
          totalBytes: 12,
          files: {
            'dataset_meta.json': { sha256: 'meta', bytes: 10 },
            'red_yellow.geojson': { sha256: 'layer', bytes: 2 },
          },
        },
        null,
        2,
      ),
      'utf-8',
    )
    await fs.writeFile(
      path.join(baseDir, 'registry.json'),
      JSON.stringify(
        {
          generatedAt: '2026-01-01T00:00:00.000Z',
          districts: [
            { districtId: 'beta', datasetHash: 'hash-beta' },
            { districtId: 'xinyi', datasetHash: 'hash-old' },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    )

    await updateRollbackRegistry({
      baseDir,
      districtId: 'xinyi',
      metaPath,
    })

    const registryRaw = await fs.readFile(path.join(baseDir, 'registry.json'), 'utf-8')
    const registry = JSON.parse(registryRaw) as {
      generatedAt: string
      districts: Array<{
        districtId: string
        datasetHash: string
        districtName?: string
      }>
    }

    expect(registry.generatedAt).toBeTypeOf('string')
    expect(registry.districts).toHaveLength(2)
    expect(registry.districts.find((entry) => entry.districtId === 'beta')?.datasetHash).toBe(
      'hash-beta',
    )
    expect(
      registry.districts.find((entry) => entry.districtId === 'xinyi'),
    ).toMatchObject({
      districtId: 'xinyi',
      districtName: 'Xinyi',
      datasetHash: 'hash-new',
    })
  })
})
