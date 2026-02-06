import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { runIngestAll } from './ingestAll'
import { readConfig } from './readConfig'
import { validateOutputs } from './validateOutputs'
import { getBoundaryFileName } from './utils'

const readJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

const writeConfig = async (configPath: string, config: Record<string, unknown>) => {
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
}

describe('multi-district ingest', () => {
  it('ingests and publishes two districts with correct manifests', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'multi-district-'))
    const configsDir = path.join(base, 'configs')
    await fs.mkdir(configsDir, { recursive: true })

    const fixturesRoot = path.resolve('tests/fixtures')

    const xinyiConfigPath = path.join(configsDir, 'xinyi.json')
    await writeConfig(xinyiConfigPath, {
      districtId: 'xinyi',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: path.join(fixturesRoot, 'xinyi', 'xinyi_boundary.geojson'),
        redYellow: path.join(fixturesRoot, 'xinyi', 'red_yellow.geojson'),
        busStops: path.join(fixturesRoot, 'xinyi', 'bus_stops.geojson'),
        hydrants: path.join(fixturesRoot, 'xinyi', 'hydrants.geojson'),
        intersections: path.join(fixturesRoot, 'xinyi', 'intersections.geojson'),
        crosswalks: path.join(fixturesRoot, 'xinyi', 'crosswalks.geojson'),
        sign_overrides: path.join(fixturesRoot, 'xinyi', 'sign_overrides.geojson'),
        candidates_inferred: path.join(fixturesRoot, 'xinyi', 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir: path.join(base, 'data', 'generated', 'xinyi'),
        publicDir: path.join(base, 'public', 'data', 'generated', 'xinyi'),
      },
      crs: { default: 'EPSG:4326' },
      ops: {
        thresholds: {
          counts: {
            segments: 1000,
            intersections: 1000,
            inferredCandidates: 1000,
            signOverrides: 1000,
          },
          tierDistributionMaxDeltaPct: 10000,
          perfRegressionMaxDeltaPct: 10000,
          maxReasonCodeDeltaPct: 10000,
          maxNewReasonCodePct: 10000,
        },
      },
      validation: {
        minCounts: {
          districtBounds: 1,
          redYellow: 1,
          busStops: 1,
          hydrants: 1,
          intersections: 1,
          crosswalks: 1,
          signOverrides: 1,
          inferredCandidates: 1,
        },
      },
    })

    const daanConfigPath = path.join(configsDir, 'daan.json')
    await writeConfig(daanConfigPath, {
      districtId: 'daan',
      districtName: 'Daan Test',
      boundary: {
        name: 'Daan',
      },
      inputs: {
        districtBounds: path.join(fixturesRoot, 'daan', 'district_bounds.geojson'),
        redYellow: path.join(fixturesRoot, 'daan', 'red_yellow.geojson'),
        busStops: path.join(fixturesRoot, 'daan', 'bus_stops.geojson'),
        hydrants: path.join(fixturesRoot, 'daan', 'hydrants.geojson'),
        intersections: path.join(fixturesRoot, 'daan', 'intersections.geojson'),
        crosswalks: path.join(fixturesRoot, 'daan', 'crosswalks.geojson'),
        sign_overrides: path.join(fixturesRoot, 'daan', 'sign_overrides.geojson'),
        candidates_inferred: path.join(fixturesRoot, 'daan', 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir: path.join(base, 'data', 'generated', 'daan'),
        publicDir: path.join(base, 'public', 'data', 'generated', 'daan'),
      },
      crs: { default: 'EPSG:4326' },
      ops: {
        thresholds: {
          counts: {
            segments: 1000,
            intersections: 1000,
            inferredCandidates: 1000,
            signOverrides: 1000,
          },
          tierDistributionMaxDeltaPct: 10000,
          perfRegressionMaxDeltaPct: 10000,
          maxReasonCodeDeltaPct: 10000,
          maxNewReasonCodePct: 10000,
        },
      },
      validation: {
        minCounts: {
          districtBounds: 1,
          redYellow: 1,
          busStops: 1,
          hydrants: 1,
          intersections: 1,
          crosswalks: 1,
          signOverrides: 1,
          inferredCandidates: 1,
        },
      },
    })

    const originalCwd = process.cwd()
    process.chdir(base)
    try {
      await runIngestAll([
        'node',
        'ingestAll',
        '--configs',
        `${configsDir.replace(/\\/g, '/')}/**/*.json`,
        '--allowWarn',
        '--override',
        'test',
      ])

      const xinyiBoundary = getBoundaryFileName('xinyi')
      const daanBoundary = getBoundaryFileName('daan')

      await expect(
        fs.access(path.join(base, 'data', 'generated', 'xinyi', xinyiBoundary)),
      ).resolves.toBeUndefined()
      await expect(
        fs.access(path.join(base, 'data', 'generated', 'daan', daanBoundary)),
      ).resolves.toBeUndefined()

      const xinyiConfig = await readConfig(['node', 'test', '--config', xinyiConfigPath])
      const daanConfig = await readConfig(['node', 'test', '--config', daanConfigPath])
      await validateOutputs(xinyiConfig)
      await validateOutputs(daanConfig)

      const manifestsRoot = path.join(base, 'public', 'data', 'generated', '_ops', 'manifests')
      const xinyiManifestDir = path.join(manifestsRoot, 'xinyi')
      const daanManifestDir = path.join(manifestsRoot, 'daan')

      const xinyiManifests = await fs.readdir(xinyiManifestDir)
      const daanManifests = await fs.readdir(daanManifestDir)
      expect(xinyiManifests.length).toBeGreaterThan(0)
      expect(daanManifests.length).toBeGreaterThan(0)

      const xinyiManifest = await readJson<Record<string, unknown>>(
        path.join(xinyiManifestDir, xinyiManifests[0]),
      )
      const daanManifest = await readJson<Record<string, unknown>>(
        path.join(daanManifestDir, daanManifests[0]),
      )

      expect(xinyiManifest.districtId).toBe('xinyi')
      expect(daanManifest.districtId).toBe('daan')
    } finally {
      process.chdir(originalCwd)
    }
  })
})
