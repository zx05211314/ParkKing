import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { parseArgs, sampleQaCandidates } from './sampleQaCandidates'

const writeJson = async (targetPath: string, payload: unknown) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}

const createFixtureDistrict = async (datasetRoot: string, districtId: string) => {
  const baseDir = path.join(datasetRoot, districtId)

  await writeJson(path.join(baseDir, 'red_yellow.geojson'), {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'seg-red', color: 'red' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.5001, 25.0501],
            [121.5003, 25.0502],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { id: 'seg-yellow', color: 'yellow' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.5004, 25.0504],
            [121.5009, 25.0507],
          ],
        },
      },
    ],
  })

  await writeJson(path.join(baseDir, 'bus_stops.geojson'), {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'bs-1' },
        geometry: { type: 'Point', coordinates: [121.7, 25.2] },
      },
    ],
  })

  await writeJson(path.join(baseDir, 'hydrants.geojson'), {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: 'hy-1' },
        geometry: { type: 'Point', coordinates: [121.7, 25.2] },
      },
    ],
  })

  await writeJson(path.join(baseDir, 'intersections.geojson'), {
    type: 'FeatureCollection',
    features: [],
  })

  await writeJson(path.join(baseDir, 'crosswalks.geojson'), {
    type: 'FeatureCollection',
    features: [],
  })

  await writeJson(path.join(baseDir, 'sign_overrides.geojson'), {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          segmentId: 'seg-yellow',
          note: 'Override fixture',
          confidence: 'HIGH',
          timeWindows: [
            {
              label: 'Any',
              startHHMM: '00:00',
              endHHMM: '23:59',
            },
          ],
          verifiedAt: '2026-01-01T00:00:00Z',
        },
        geometry: {
          type: 'Point',
          coordinates: [121.50045, 25.05045],
        },
      },
    ],
  })

  await writeJson(path.join(baseDir, 'candidates_inferred.geojson'), {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: 'cand-1',
          riskTags: ['MAJOR_ROAD'],
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.501, 25.051],
            [121.5012, 25.0512],
          ],
        },
      },
    ],
  })

  await writeJson(path.join(baseDir, 'dataset_meta.json'), {
    districtId,
    districtName: 'Demo',
    datasetHash: 'demo-hash',
    boundaryCenter: [121.5004, 25.0504],
    signOverrideMatchToleranceMeters: 20,
  })
}

describe('sampleQaCandidates', () => {
  it('accepts --count as alias for --topN', () => {
    const parsed = parseArgs([
      'node',
      'sampleQaCandidates',
      '--district',
      'demo',
      '--count',
      '7',
    ])
    expect(parsed.topN).toBe(7)
  })

  it('writes deterministic CSV with reason keys and maps URLs', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-sampler-test-'))
    const publicRoot = path.join(base, 'public', 'data', 'generated')
    const dataRoot = path.join(base, 'data', 'generated')
    await createFixtureDistrict(publicRoot, 'demo')

    const outA = path.join(base, 'out-a.csv')
    const outB = path.join(base, 'out-b.csv')

    await sampleQaCandidates({
      districtId: 'demo',
      topN: 5,
      outPath: outA,
      riskMode: 'NEUTRAL',
      radiusMeters: 600,
      datasetRoots: [publicRoot, dataRoot],
    })
    await sampleQaCandidates({
      districtId: 'demo',
      topN: 5,
      outPath: outB,
      riskMode: 'NEUTRAL',
      radiusMeters: 600,
      datasetRoots: [publicRoot, dataRoot],
    })

    const csvA = await fs.readFile(outA, 'utf-8')
    const csvB = await fs.readFile(outB, 'utf-8')

    expect(csvA).toBe(csvB)
    expect(csvA).toContain('topReasons[]')
    expect(csvA).toMatch(/https:\/\/www\.google\.com\/maps\?q=-?\d+\.\d{6},-?\d+\.\d{6}/)
    expect(csvA).toMatch(/RULE_[A-Z_]+/)
  })

  it('shuffles deterministically with --seed and supports count param', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'qa-sampler-test-'))
    const publicRoot = path.join(base, 'public', 'data', 'generated')
    const dataRoot = path.join(base, 'data', 'generated')
    await createFixtureDistrict(publicRoot, 'demo')

    const outA = path.join(base, 'shuffle-a.csv')
    const outB = path.join(base, 'shuffle-b.csv')

    const resultA = await sampleQaCandidates({
      districtId: 'demo',
      count: 3,
      outPath: outA,
      riskMode: 'NEUTRAL',
      radiusMeters: 600,
      shuffle: true,
      seed: 7,
      datasetRoots: [publicRoot, dataRoot],
    })
    const resultB = await sampleQaCandidates({
      districtId: 'demo',
      count: 3,
      outPath: outB,
      riskMode: 'NEUTRAL',
      radiusMeters: 600,
      shuffle: true,
      seed: 7,
      datasetRoots: [publicRoot, dataRoot],
    })

    const csvA = await fs.readFile(outA, 'utf-8')
    const csvB = await fs.readFile(outB, 'utf-8')

    expect(resultA[0]?.rowCount).toBe(3)
    expect(resultB[0]?.rowCount).toBe(3)
    expect(csvA).toBe(csvB)
  })
})
