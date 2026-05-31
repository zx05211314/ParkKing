import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { writeRollbackManifestAndLatestPointer } from './rollbackPackManifestOutput'

describe('rollbackPackManifestOutput', () => {
  it('writes rollback manifest and latest pointer from published meta state', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'rollback-manifest-'))
    const districtId = 'xinyi'
    const districtDir = path.join(baseDir, districtId)
    const metaPath = path.join(districtDir, 'dataset_meta.json')
    await fs.mkdir(districtDir, { recursive: true })
    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          districtName: 'Xinyi',
          schemaVersion: 3,
          datasetHash: 'hash-rollback',
          configHash: 'cfg-1',
          generatedAt: '2026-03-01T01:00:00.000Z',
          publishedAt: '2026-03-01T02:00:00.000Z',
          totalBytes: 42,
          files: {
            'dataset_meta.json': { sha256: 'meta', bytes: 20 },
            'red_yellow.geojson': { sha256: 'layer', bytes: 22 },
          },
        },
        null,
        2,
      ),
      'utf-8',
    )

    const result = await writeRollbackManifestAndLatestPointer({
      baseDir,
      districtId,
      metaPath,
    })

    await expect(fs.access(result.manifestPath)).resolves.toBeUndefined()
    expect(result.latestPointer).toMatchObject({
      datasetHash: 'hash-rollback',
      schemaVersion: 3,
    })

    const latestRaw = await fs.readFile(path.join(districtDir, 'LATEST.json'), 'utf-8')
    const latest = JSON.parse(latestRaw) as {
      datasetHash: string
      manifestPath: string
      schemaVersion: number
    }
    expect(latest).toMatchObject({
      datasetHash: 'hash-rollback',
      schemaVersion: 3,
    })
    expect(latest.manifestPath).toMatch(/^_ops\/manifests\/xinyi\//)
  })
})
