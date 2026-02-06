import { describe, expect, it, vi, afterEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { fetchSources } from './fetchSources'

const hashBuffer = (buffer: Buffer) =>
  createHash('sha256').update(buffer).digest('hex')

const toArrayBuffer = (buffer: Buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)

describe('fetchSources provenance', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes provenance manifest with sha256 entries', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sources-test-'))
    const manifestPath = path.join(base, 'sources.json')
    const configPath = path.join(base, 'config.json')
    const destRelative = 'data/raw/xinyi/source.txt'
    const buffer = Buffer.from('fixture-data')
    const digest = hashBuffer(buffer)

    const configPayload = {
      districtId: 'xinyi',
      inputs: {
        districtBounds: 'data/raw/xinyi/district_bounds.geojson',
        redYellow: 'data/raw/xinyi/red_yellow.geojson',
        busStops: 'data/raw/xinyi/bus_stops.geojson',
        hydrants: 'data/raw/xinyi/hydrants.geojson',
      },
    }

    await fs.writeFile(configPath, JSON.stringify(configPayload, null, 2), 'utf-8')
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          districtId: 'xinyi',
          configPath: './config.json',
          sources: [
            {
              url: 'https://example.com/source.txt',
              dest: destRelative,
              sha256: digest,
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    )

    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => toArrayBuffer(buffer),
    }))

    await fetchSources({ manifestPath, provenanceRoot: base })

    const provenancePath = path.join(base, 'data', 'sources', 'xinyi', 'provenance.json')
    const raw = await fs.readFile(provenancePath, 'utf-8')
    const provenance = JSON.parse(raw) as {
      schemaVersion: number
      districtId: string
      configHash: string
      files: Array<{ relativePath: string; sizeBytes: number; sha256: string }>
    }

    expect(provenance.schemaVersion).toBe(1)
    expect(provenance.districtId).toBe('xinyi')
    expect(provenance.configHash).toBe(hashBuffer(Buffer.from(JSON.stringify(configPayload, null, 2))))
    expect(provenance.files[0]?.relativePath).toBe(destRelative)
    expect(provenance.files[0]?.sha256).toBe(digest)
    expect(provenance.files[0]?.sizeBytes).toBe(buffer.length)
  })

  it('supports district manifests in a single file', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'sources-test-multi-'))
    const manifestPath = path.join(base, 'sources.json')

    const xinyiConfigPath = path.join(base, 'xinyi.config.json')
    const daanConfigPath = path.join(base, 'daan.config.json')
    await fs.writeFile(
      xinyiConfigPath,
      JSON.stringify({ districtId: 'xinyi', inputs: {} }, null, 2),
      'utf-8',
    )
    await fs.writeFile(
      daanConfigPath,
      JSON.stringify({ districtId: 'daan', inputs: {} }, null, 2),
      'utf-8',
    )

    const xinyiBuffer = Buffer.from('xinyi-source')
    const daanBuffer = Buffer.from('daan-source')
    const xinyiHash = hashBuffer(xinyiBuffer)
    const daanHash = hashBuffer(daanBuffer)

    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          districts: [
            {
              districtId: 'xinyi',
              configPath: './xinyi.config.json',
              sources: [
                {
                  url: 'https://example.com/xinyi.bin',
                  dest: 'data/raw/xinyi/source.bin',
                  sha256: xinyiHash,
                  notes: 'xinyi fixture',
                },
              ],
            },
            {
              districtId: 'daan',
              configPath: './daan.config.json',
              sources: [
                {
                  url: 'https://example.com/daan.bin',
                  dest: 'data/raw/daan/source.bin',
                  sha256: daanHash,
                  notes: 'daan fixture',
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
      'utf-8',
    )

    vi.stubGlobal('fetch', async (url: string | URL) => {
      const asString = String(url)
      const buffer =
        asString.includes('xinyi') ? xinyiBuffer : daanBuffer
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => toArrayBuffer(buffer),
      }
    })

    await fetchSources({ manifestPath, provenanceRoot: base })

    const xinyiRaw = await fs.readFile(
      path.join(base, 'data', 'sources', 'xinyi', 'provenance.json'),
      'utf-8',
    )
    const daanRaw = await fs.readFile(
      path.join(base, 'data', 'sources', 'daan', 'provenance.json'),
      'utf-8',
    )
    const xinyi = JSON.parse(xinyiRaw) as {
      districtId: string
      files: Array<{ relativePath: string; sha256: string }>
    }
    const daan = JSON.parse(daanRaw) as {
      districtId: string
      files: Array<{ relativePath: string; sha256: string }>
    }

    expect(xinyi.districtId).toBe('xinyi')
    expect(xinyi.files[0]?.relativePath).toBe('data/raw/xinyi/source.bin')
    expect(xinyi.files[0]?.sha256).toBe(xinyiHash)

    expect(daan.districtId).toBe('daan')
    expect(daan.files[0]?.relativePath).toBe('data/raw/daan/source.bin')
    expect(daan.files[0]?.sha256).toBe(daanHash)
  })
})
