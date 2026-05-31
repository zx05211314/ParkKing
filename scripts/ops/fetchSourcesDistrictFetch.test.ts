import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { fetchDistrictSources } from './fetchSourcesDistrictFetch'

const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const toArrayBuffer = (buffer: Buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

describe('fetchDistrictSources', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when a district manifest has no sources', async () => {
    expect(
      await fetchDistrictSources({
        districtManifest: { districtId: 'xinyi', sources: [] },
        manifestDir: process.cwd(),
        provenanceRoot: process.cwd(),
        dryRun: false,
      }),
    ).toBe(false)
  })

  it('writes provenance for a district manifest with sources', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'fetch-district-'))
    const configPath = path.join(baseDir, 'config.json')
    const buffer = Buffer.from('fixture-data')
    const digest = hashBuffer(buffer)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await fs.writeFile(
      configPath,
      JSON.stringify({ districtId: 'xinyi', inputs: {} }, null, 2),
      'utf-8',
    )

    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => toArrayBuffer(buffer),
    }))

    const processed = await fetchDistrictSources({
      districtManifest: {
        districtId: 'xinyi',
        configPath: './config.json',
        sources: [
          {
            url: 'https://example.com/source.txt',
            dest: 'data/raw/xinyi/source.txt',
            sha256: digest,
          },
        ],
      },
      manifestDir: baseDir,
      provenanceRoot: baseDir,
      dryRun: false,
    })

    expect(processed).toBe(true)
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fetched https://example.com/source.txt'),
    )

    const provenance = JSON.parse(
      await fs.readFile(path.join(baseDir, 'data', 'sources', 'xinyi', 'provenance.json'), 'utf-8'),
    ) as { districtId: string; files: Array<{ relativePath: string; sha256: string }> }

    expect(provenance.districtId).toBe('xinyi')
    expect(provenance.files[0]?.relativePath).toBe('data/raw/xinyi/source.txt')
    expect(provenance.files[0]?.sha256).toBe(digest)
  })
})
