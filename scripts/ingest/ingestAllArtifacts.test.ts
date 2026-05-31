import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  copyProvenance,
  formatBBox,
  hashBuffer,
  readBoundaryBBox,
} from './ingestAllArtifacts'

const originalCwd = process.cwd()

afterEach(() => {
  process.chdir(originalCwd)
})

describe('ingestAllArtifacts', () => {
  it('reads boundary bboxes and formats them', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-artifacts-'))
    const boundaryPath = path.join(base, 'boundary.geojson')
    await fs.writeFile(
      boundaryPath,
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [121.5, 25.0],
                  [121.6, 25.0],
                  [121.6, 25.1],
                  [121.5, 25.1],
                  [121.5, 25.0],
                ],
              ],
            },
            properties: {},
          },
        ],
      }),
      'utf-8',
    )

    const bbox = await readBoundaryBBox(base, 'boundary.geojson')
    expect(bbox).toEqual({
      minX: 121.5,
      minY: 25,
      maxX: 121.6,
      maxY: 25.1,
    })
    expect(formatBBox(bbox)).toBe('121.5000,25.0000 -> 121.6000,25.1000')
    expect(hashBuffer(Buffer.from('abc'))).toHaveLength(64)
  })

  it('copies provenance into generated output when present', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-provenance-'))
    process.chdir(base)
    const sourceDir = path.join(base, 'data', 'sources', 'xinyi')
    const generatedDir = path.join(base, 'generated')
    await fs.mkdir(sourceDir, { recursive: true })
    await fs.mkdir(generatedDir, { recursive: true })
    await fs.writeFile(
      path.join(sourceDir, 'provenance.json'),
      JSON.stringify({ fetchedAt: '2026-03-01T00:00:00.000Z' }),
      'utf-8',
    )

    await copyProvenance({
      districtId: 'xinyi',
      outputs: {
        generatedDir,
        publicDir: path.join(base, 'public'),
      },
    } as never)

    const copied = await fs.readFile(path.join(generatedDir, 'provenance.json'), 'utf-8')
    expect(copied).toContain('fetchedAt')
  })
})
