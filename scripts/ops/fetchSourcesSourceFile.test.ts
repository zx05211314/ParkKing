import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { fetchSourceFile } from './fetchSourcesSourceFile'

const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const toArrayBuffer = (buffer: Buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

describe('fetchSourceFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('supports dry-run without writing the file', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'fetch-source-file-'))
    const buffer = Buffer.from('fixture-data')
    const digest = hashBuffer(buffer)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => toArrayBuffer(buffer),
    }))

    const entry = await fetchSourceFile({
      source: {
        url: 'https://example.com/source.txt',
        dest: 'data/raw/xinyi/source.txt',
        sha256: digest,
      },
      manifestDir: baseDir,
      provenanceRoot: baseDir,
      dryRun: true,
    })

    expect(entry).toBeNull()
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[dryRun] https://example.com/source.txt'),
    )
    await expect(fs.access(path.join(baseDir, 'data', 'raw', 'xinyi', 'source.txt'))).rejects.toThrow()
  })
})
