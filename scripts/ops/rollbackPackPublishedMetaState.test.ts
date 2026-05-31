import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { readRollbackPublishedMetaState } from './rollbackPackPublishedMetaState'

describe('rollbackPackPublishedMetaState', () => {
  it('reads published meta state and computes hashes', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'rollback-meta-'))
    const metaPath = path.join(baseDir, 'dataset_meta.json')

    await fs.writeFile(
      metaPath,
      JSON.stringify(
        {
          datasetHash: 'hash-rollback',
          publishedAt: '2026-03-01T02:00:00.000Z',
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

    const metaState = await readRollbackPublishedMetaState(metaPath)
    expect(metaState.meta.datasetHash).toBe('hash-rollback')
    expect(metaState.files).toEqual({
      'dataset_meta.json': { sha256: 'meta', bytes: 20 },
      'red_yellow.geojson': { sha256: 'layer', bytes: 22 },
    })
    expect(metaState.metaSha256).toHaveLength(64)
    expect(metaState.packSha256).toHaveLength(64)
    expect(metaState.publishedAt).toBe('2026-03-01T02:00:00.000Z')
  })
})
