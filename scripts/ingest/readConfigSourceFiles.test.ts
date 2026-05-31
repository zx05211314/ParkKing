import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildConfigHashes,
  collectSourceFiles,
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
    expect(hashString('abc')).toHaveLength(64)
    expect(buildConfigHashes('raw-config', sourceFiles)).toEqual({
      configHash: hashString('raw-config'),
      datasetHash: hashString(
        JSON.stringify({
          configHash: hashString('raw-config'),
          sourceFiles,
        }),
      ),
    })
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
})
