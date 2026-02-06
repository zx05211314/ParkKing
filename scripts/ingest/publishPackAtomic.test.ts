import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { publishPackAtomic } from './publishPackAtomic'

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

describe('publishPackAtomic', () => {
  it('publishes via staging and records publishedAt without mutating source', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-test-'))
    const sourceDir = path.join(base, 'source')
    const destDir = path.join(base, 'public', 'xinyi')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'red_yellow.geojson'), '{"type":"FeatureCollection","features":[]}')
    await fs.writeFile(
      path.join(sourceDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-new' }, null, 2),
      'utf-8',
    )

    await fs.mkdir(destDir, { recursive: true })
    await fs.writeFile(
      path.join(destDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-old' }, null, 2),
      'utf-8',
    )

    const result = await publishPackAtomic({ sourceDir, destDir })

    const publishedMeta = await readJson<Record<string, unknown>>(
      path.join(destDir, 'dataset_meta.json'),
    )
    const sourceMeta = await readJson<Record<string, unknown>>(
      path.join(sourceDir, 'dataset_meta.json'),
    )
    expect(publishedMeta.publishMode).toBe('atomic')
    expect(typeof publishedMeta.publishedAt).toBe('string')
    expect(sourceMeta.publishMode).toBeUndefined()
    expect(sourceMeta.publishedAt).toBeUndefined()
    expect(result.destDir).toBe(destDir)
    expect(result.backupDir).not.toBeNull()
  })

  it('does not write to destDir when dryRun is true', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-dry-'))
    const sourceDir = path.join(base, 'source')
    const destDir = path.join(base, 'public', 'xinyi')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'red_yellow.geojson'), '{"type":"FeatureCollection","features":[]}')
    await fs.writeFile(
      path.join(sourceDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-new', files: {}, totalBytes: 0 }, null, 2),
      'utf-8',
    )

    await publishPackAtomic({ sourceDir, destDir, dryRun: true })

    await expect(fs.stat(destDir)).rejects.toThrow()
  })

  it('does not swap when failing before swap', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-before-'))
    const sourceDir = path.join(base, 'source')
    const destDir = path.join(base, 'public', 'xinyi')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'red_yellow.geojson'), '{"type":"FeatureCollection","features":[]}')
    await fs.writeFile(
      path.join(sourceDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-new' }, null, 2),
      'utf-8',
    )

    await fs.mkdir(destDir, { recursive: true })
    await fs.writeFile(
      path.join(destDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-old' }, null, 2),
      'utf-8',
    )

    await expect(
      publishPackAtomic({
        sourceDir,
        destDir,
        hooks: {
          beforeSwap: () => {
            throw new Error('fail-before')
          },
        },
      }),
    ).rejects.toThrow('fail-before')

    const publishedMeta = await readJson<Record<string, unknown>>(
      path.join(destDir, 'dataset_meta.json'),
    )
    expect(publishedMeta.datasetHash).toBe('hash-old')
  })

  it('swaps but leaves LATEST untouched when failing after swap', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'publish-after-'))
    const sourceDir = path.join(base, 'source')
    const destDir = path.join(base, 'public', 'xinyi')

    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(path.join(sourceDir, 'red_yellow.geojson'), '{"type":"FeatureCollection","features":[]}')
    await fs.writeFile(
      path.join(sourceDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-new' }, null, 2),
      'utf-8',
    )

    await fs.mkdir(destDir, { recursive: true })
    await fs.writeFile(
      path.join(destDir, 'dataset_meta.json'),
      JSON.stringify({ datasetHash: 'hash-old' }, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      path.join(destDir, 'LATEST.json'),
      JSON.stringify({ datasetHash: 'hash-old', publishedAt: 'old' }, null, 2),
      'utf-8',
    )

    await expect(
      publishPackAtomic({
        sourceDir,
        destDir,
        hooks: {
          afterSwap: () => {
            throw new Error('fail-after')
          },
        },
      }),
    ).rejects.toThrow('fail-after')

    const publishedMeta = await readJson<Record<string, unknown>>(
      path.join(destDir, 'dataset_meta.json'),
    )
    const latest = await readJson<Record<string, unknown>>(
      path.join(destDir, 'LATEST.json'),
    )
    expect(publishedMeta.datasetHash).toBe('hash-new')
    expect(latest.datasetHash).toBe('hash-old')
  })
})
