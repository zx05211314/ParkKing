import * as fs from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
  precompressStaticData,
  shouldPrecompressStaticFile,
} from './precompressStaticData'

const gunzipAsync = promisify(gunzip)

describe('shouldPrecompressStaticFile', () => {
  it('selects large generated JSON formats only', () => {
    expect(shouldPrecompressStaticFile('parking_spaces.geojson', 10_000)).toBe(true)
    expect(shouldPrecompressStaticFile('registry.json', 10_000)).toBe(true)
    expect(shouldPrecompressStaticFile('history.jsonl', 10_000)).toBe(true)
    expect(shouldPrecompressStaticFile('small.json', 100)).toBe(false)
    expect(shouldPrecompressStaticFile('image.png', 10_000)).toBe(false)
    expect(shouldPrecompressStaticFile('data.json.gz', 10_000)).toBe(false)
  })
})

describe('precompressStaticData', () => {
  it('writes deterministic gzip sidecars and skips unrelated files', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'parkking-precompress-'))
    const nestedDir = path.join(rootDir, 'zhongshan')
    await fs.mkdir(nestedDir, { recursive: true })
    const source = JSON.stringify({ features: Array.from({ length: 500 }, () => ({ id: 1 })) })
    const sourcePath = path.join(nestedDir, 'parking_spaces.geojson')
    await fs.writeFile(sourcePath, source)
    await fs.writeFile(path.join(nestedDir, 'note.txt'), source)
    await fs.writeFile(path.join(nestedDir, 'small.json'), '{}')

    const first = await precompressStaticData({ rootDir, minBytes: 100 })
    const compressed = await fs.readFile(`${sourcePath}.gz`)

    expect((await gunzipAsync(compressed)).toString('utf-8')).toBe(source)
    expect(first.compressedFiles).toBe(1)
    expect(first.sourceBytes).toBe(Buffer.byteLength(source))
    expect(first.compressedBytes).toBeLessThan(first.sourceBytes)
    await expect(fs.stat(path.join(nestedDir, 'note.txt.gz'))).rejects.toThrow()
    await expect(fs.stat(path.join(nestedDir, 'small.json.gz'))).rejects.toThrow()

    const second = await precompressStaticData({ rootDir, minBytes: 100 })
    expect(second).toMatchObject({
      scannedFiles: 3,
      compressedFiles: 1,
      sourceBytes: first.sourceBytes,
      compressedBytes: first.compressedBytes,
    })
  })
})
