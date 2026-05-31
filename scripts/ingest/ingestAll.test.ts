import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { runIngestAll } from './ingestAll'

describe('ingestAll publish gate', () => {
  it('does not publish packs when gate fails', async () => {
    const baseDir = await fs.mkdtemp(path.join(tmpdir(), 'ingest-all-'))
    const fixturesDir = path.resolve('tests/fixtures/xinyi')
    const configPath = path.join(baseDir, 'config.json')
    const config = {
      districtId: 'xinyi-test',
      districtName: 'Xinyi Test',
      inputs: {
        districtBounds: path.join(fixturesDir, 'xinyi_boundary.geojson'),
        redYellow: path.join(fixturesDir, 'red_yellow.geojson'),
        busStops: path.join(fixturesDir, 'bus_stops.geojson'),
        hydrants: path.join(fixturesDir, 'hydrants.geojson'),
        intersections: path.join(fixturesDir, 'intersections.geojson'),
        crosswalks: path.join(fixturesDir, 'crosswalks.geojson'),
        sign_overrides: path.join(fixturesDir, 'sign_overrides.geojson'),
        candidates_inferred: path.join(fixturesDir, 'candidates_inferred.geojson'),
      },
      outputs: {
        generatedDir: path.join(baseDir, 'data', 'generated', 'xinyi-test'),
        publicDir: path.join(baseDir, 'public', 'data', 'generated', 'xinyi-test'),
      },
      crs: {
        default: 'EPSG:4326',
      },
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
    }

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')

    const originalCwd = process.cwd()
    process.chdir(baseDir)
    try {
      const glob = configPath.replace(/\\/g, '/')
      await expect(
        runIngestAll(['node', 'ingestAll', '--configs', glob]),
      ).rejects.toThrow(/Publish gate failed/)

      const publishedMeta = path.join(
        baseDir,
        'public',
        'data',
        'generated',
        'xinyi-test',
        'dataset_meta.json',
      )
      await expect(fs.access(publishedMeta)).rejects.toThrow()
    } finally {
      process.chdir(originalCwd)
    }
  }, 20000)
})
