import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import crypto from 'node:crypto'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildConfigHashes,
  collectSourceFiles,
  hashSourceContent,
  hashString,
} from './readConfigSourceFiles'

describe('readConfigSourceFiles', () => {
  it('collects source file metadata and hashes deterministically', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'read-config-source-'))
    const first = path.join(base, 'a.geojson')
    const second = path.join(base, 'b.geojson')
    await fs.writeFile(first, 'a', 'utf-8')
    await fs.writeFile(second, 'bb', 'utf-8')

    const sourceFiles = await collectSourceFiles({
      districtBounds: first,
      redYellow: second,
      busStops: first,
      hydrants: second,
    } as never)

    expect(sourceFiles).toHaveLength(4)
    expect(sourceFiles.map((entry) => entry.sourceKey)).toEqual([
      'districtBounds',
      'redYellow',
      'busStops',
      'hydrants',
    ])
    expect(sourceFiles.every((entry) => entry.contentHash?.length === 64)).toBe(true)
    expect(hashString('abc')).toHaveLength(64)
    expect(buildConfigHashes('raw-config', sourceFiles).configHash).toBe(
      hashString('raw-config'),
    )
    expect(buildConfigHashes('raw-config', sourceFiles).datasetHash).toHaveLength(64)
  })

  it('throws when an input file is missing', async () => {
    await expect(
      collectSourceFiles({
        districtBounds: path.join(tmpdir(), 'missing.geojson'),
      } as never),
    ).rejects.toThrow(/Input file not found/)
  })

  it('includes existing optional files without requiring missing optional files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'read-config-optional-'))
    const required = path.join(base, 'required.geojson')
    const optional = path.join(base, 'xinyi.jsonl')
    const missingOptional = path.join(base, 'missing.jsonl')
    await fs.writeFile(required, 'required', 'utf-8')
    await fs.writeFile(optional, 'optional', 'utf-8')

    const sourceFiles = await collectSourceFiles(
      {
        districtBounds: required,
      } as never,
      [optional, missingOptional],
    )

    expect(sourceFiles.map((entry) => entry.path)).toEqual([required, optional])
  })

  it('keeps dataset hashes stable across paths, mtimes, and line endings', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'read-config-stable-'))
    const first = path.join(base, 'first.csv')
    const second = path.join(base, 'nested', 'second.csv')
    await fs.mkdir(path.dirname(second), { recursive: true })
    await fs.writeFile(first, 'a,b\r\n1,2\r\n', 'utf-8')
    await fs.writeFile(second, 'a,b\n1,2\n', 'utf-8')
    await fs.utimes(first, new Date(1_000), new Date(1_000))
    await fs.utimes(second, new Date(2_000), new Date(2_000))

    const [firstMeta] = await collectSourceFiles({
      districtBounds: first,
    } as never)
    const [secondMeta] = await collectSourceFiles({
      districtBounds: second,
    } as never)

    expect(firstMeta?.contentHash).toBe(secondMeta?.contentHash)
    expect(buildConfigHashes('config\r\n', [firstMeta!])).toEqual(
      buildConfigHashes('config\n', [secondMeta!]),
    )
  })

  it('hashes a shapefile source through its complete source archive', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'read-config-shape-'))
    const sourceDir = path.join(base, 'roads')
    const shapePath = path.join(sourceDir, 'roads.shp')
    const archivePath = path.join(base, 'roads.zip')
    await fs.mkdir(sourceDir, { recursive: true })
    await fs.writeFile(shapePath, 'shape', 'utf-8')
    await fs.writeFile(archivePath, 'archive-family', 'utf-8')

    expect(await hashSourceContent(shapePath)).toBe(
      crypto.createHash('sha256').update('archive-family').digest('hex'),
    )
  })
})
